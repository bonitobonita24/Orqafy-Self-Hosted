// Documents (D-13 thin-slice, D-20 SPI). Bytes live in object storage
// (@orqafy/storage — Part 6); this router owns the metadata rows + the review
// tray. `isSPI` docs (payroll/HR) are gated behind `view_finances` and excluded
// from broad listing (PH DPA, D-20).
//
// TODO(part-6): the actual upload (presigned PUT to MinIO/S3), OCR text
// extraction, and the auto-filing confidence matcher are worker-driven and land
// with @orqafy/storage + @orqafy/jobs. Here they are metadata operations.
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { documentCategoryEnum, documentReviewStatusEnum } from '@orqafy/shared';
import { isDocumentKey } from '@orqafy/storage';
import { router, protectedProcedure, permissionProcedure } from '../trpc';
import { isUniqueViolation, omitUndefined } from '../util';
import { enqueueOcr } from '../queues';
import { getStorageAdapter } from '../storage';
import { writeAudit } from '../audit';

/**
 * Generic refusal for a storageKey that already backs a Document (ORQ-26). It
 * deliberately says nothing about the other row (id, name, SPI flag).
 */
const KEY_ALREADY_COMMITTED = 'This upload has already been committed. Upload the file again.';

export const documentsRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          projectId: z.string().min(1).optional(),
          category: documentCategoryEnum.optional(),
          q: z.string().min(1).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const canSeeSPI = ctx.permissions.has('view_finances');
      return ctx.prisma.document.findMany({
        where: {
          ...omitUndefined({ projectId: input?.projectId, category: input?.category }),
          // SPI docs excluded from broad listing unless the caller has finance sight.
          ...(canSeeSPI ? {} : { isSPI: false }),
          // v1 search = case-insensitive ILIKE on ocrText. Graduation path: Postgres
          // tsvector + GIN index on ocrText (TODO if scale demands).
          ...(input?.q ? { ocrText: { contains: input.q, mode: 'insensitive' as const } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: { project: { select: { id: true, name: true } } },
      });
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const doc = await ctx.prisma.document.findUnique({ where: { id: input.id } });
      if (doc === null) throw new TRPCError({ code: 'NOT_FOUND' });
      if (doc.isSPI && !ctx.permissions.has('view_finances')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'This document is restricted.' });
      }
      // DPA W10: log the SPI metadata VIEW itself (not just the byte download) —
      // audit write failure must never break the read (fail-open on audit,
      // never on authz — the FORBIDDEN/NOT_FOUND branches above already ran).
      if (doc.isSPI) {
        try {
          await writeAudit(ctx.prisma, {
            userId: ctx.userId,
            action: 'document.view_spi',
            targetType: 'document',
            targetId: doc.id,
            metadata: { isSPI: true },
          });
        } catch (err) {
          console.warn('Audit write failed (document.view_spi)', err);
        }
      }
      return doc;
    }),

  /** Count of documents still awaiting review (the dashboard "unsorted" tile). */
  unsortedCount: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.documentReview.count({ where: { status: 'pending' } });
  }),

  // SPI docs excluded from the review tray (audit H-1) unless the caller has
  // finance sight — mirrors `list`'s canSeeSPI/isSPI:false pattern.
  reviewTray: permissionProcedure('manage_files').query(async ({ ctx }) => {
    const canSeeSPI = ctx.permissions.has('view_finances');
    return ctx.prisma.documentReview.findMany({
      where: { status: 'pending', ...(canSeeSPI ? {} : { file: { isSPI: false } }) },
      orderBy: { confidence: 'asc' },
      include: {
        file: { select: { id: true, name: true, category: true } },
        suggestedClient: { select: { id: true, name: true } },
        suggestedProject: { select: { id: true, name: true } },
      },
    });
  }),

  /** Confirm/reassign a review-tray suggestion (D-13 triage). */
  decideReview: permissionProcedure('manage_files')
    .input(
      z.object({
        reviewId: z.string().min(1),
        status: documentReviewStatusEnum,
        projectId: z.string().min(1).optional(),
        clientId: z.string().min(1).optional(),
        category: documentCategoryEnum.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const review = await ctx.prisma.documentReview.findUnique({
        where: { id: input.reviewId },
        include: { file: { select: { isSPI: true } } },
      });
      if (review === null) throw new TRPCError({ code: 'NOT_FOUND' });
      // H-1: a review of an SPI document is itself finance-gated.
      if (review.file.isSPI && !ctx.permissions.has('view_finances')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'This document is restricted.' });
      }

      // Apply the human decision to the underlying document, then close the row.
      await ctx.prisma.document.update({
        where: { id: review.fileId },
        data: omitUndefined({
          projectId: input.projectId,
          clientId: input.clientId,
          category: input.category,
        }),
      });
      return ctx.prisma.documentReview.update({
        where: { id: input.reviewId },
        data: { status: input.status },
      });
    }),

  /**
   * Commit a document metadata row after its bytes were uploaded via
   * `/api/media` (which returns `storageKey`, `size`, `mimeType`). Enqueues an
   * OCR job best-effort — a queue outage never rolls back the committed row.
   */
  create: permissionProcedure('manage_files')
    .input(
      z.object({
        name: z.string().min(1),
        category: documentCategoryEnum,
        projectId: z.string().min(1).optional(),
        clientId: z.string().min(1).optional(),
        isSPI: z.boolean().optional(),
        storageKey: z.string().min(1),
        size: z.number().int().nonnegative(),
        mimeType: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Only keys /api/media produces (`documents/<uuid>/<name>`) may be
      // committed — never a site photo (D-28) or any other object, which would
      // otherwise become downloadable via /api/media/[id].
      if (!isDocumentKey(input.storageKey)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid document storageKey.' });
      }
      // ORQ-26: one Document per storageKey. /api/media mints a fresh
      // `documents/<uuid>/<name>` key per upload, so a legitimate commit never
      // reuses one; a reused key means someone is re-registering an existing
      // object (e.g. an SPI document with isSPI:false to bypass view_finances,
      // and whose delete would also remove the original's bytes). The DB
      // @unique on Document.storageKey is the real guarantee (P2002 below);
      // this pre-check just answers the common case without a failed insert.
      const taken = await ctx.prisma.document.findFirst({
        where: { storageKey: input.storageKey },
        select: { id: true },
      });
      if (taken !== null) {
        throw new TRPCError({ code: 'CONFLICT', message: KEY_ALREADY_COMMITTED });
      }
      // The bytes must actually exist — no rows for objects never uploaded.
      if (!(await getStorageAdapter().objectExists(input.storageKey))) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Uploaded file not found.' });
      }

      let doc;
      try {
        doc = await ctx.prisma.document.create({
          data: {
            name: input.name,
            category: input.category,
            storageKey: input.storageKey,
            size: input.size,
            mimeType: input.mimeType,
            isSPI: input.isSPI ?? false,
            uploadedBy: ctx.userId,
            ...omitUndefined({ projectId: input.projectId, clientId: input.clientId }),
          },
        });
      } catch (err) {
        // A concurrent commit of the same key won the race.
        if (isUniqueViolation(err)) {
          throw new TRPCError({ code: 'CONFLICT', message: KEY_ALREADY_COMMITTED });
        }
        throw err;
      }

      try {
        await enqueueOcr({ documentId: doc.id, revisionId: '0', storageKey: doc.storageKey });
      } catch (e) {
        console.error('OCR enqueue failed', e);
      }

      return doc;
    }),

  /** Edit document metadata (filing/category/SPI flag). Bytes are immutable. */
  update: permissionProcedure('manage_files')
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).optional(),
        category: documentCategoryEnum.optional(),
        projectId: z.string().min(1).optional(),
        clientId: z.string().min(1).optional(),
        isSPI: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const canViewFinances = ctx.permissions.has('view_finances');

      const doc = await ctx.prisma.document.findUnique({ where: { id }, select: { isSPI: true } });
      if (doc === null) throw new TRPCError({ code: 'NOT_FOUND' });
      // H-1: an SPI document's metadata (incl. ocrText) is finance-gated.
      if (doc.isSPI && !canViewFinances) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'This document is restricted.' });
      }
      // Only a view_finances holder may SET or CHANGE the isSPI flag itself —
      // otherwise a manage_files-only caller could un-gate an SPI document by
      // flipping it to false, or gate-then-immediately-read one of their own.
      if (rest.isSPI !== undefined && !canViewFinances) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Missing required permission(s): view_finances',
        });
      }

      return ctx.prisma.document.update({
        where: { id },
        data: omitUndefined(rest),
        select: {
          id: true,
          name: true,
          storageKey: true,
          projectId: true,
          clientId: true,
          category: true,
          mimeType: true,
          size: true,
          ocrStatus: true,
          isSPI: true,
          uploadedBy: true,
          createdAt: true,
          updatedAt: true,
          // ocrText deliberately omitted — it can hold SPI content and has no
          // reason to round-trip back from a metadata edit.
        },
      });
    }),

  /** Delete a document: best-effort remove the bytes, then the metadata row. */
  delete: permissionProcedure('manage_files')
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.document.findUnique({ where: { id: input.id } });
      if (doc === null) throw new TRPCError({ code: 'NOT_FOUND' });
      // H-1: deleting an SPI document is finance-gated too.
      if (doc.isSPI && !ctx.permissions.has('view_finances')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'This document is restricted.' });
      }

      try {
        await getStorageAdapter().deleteObject(doc.storageKey);
      } catch (e) {
        console.error('Storage delete failed (row will still be removed)', e);
      }

      await ctx.prisma.document.delete({ where: { id: input.id } });
      return { id: input.id };
    }),
});
