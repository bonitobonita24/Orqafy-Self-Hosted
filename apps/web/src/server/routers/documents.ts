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
import { omitUndefined } from '../util';
import { enqueueOcr } from '../queues';
import { getStorageAdapter } from '../storage';

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
      return doc;
    }),

  /** Count of documents still awaiting review (the dashboard "unsorted" tile). */
  unsortedCount: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.documentReview.count({ where: { status: 'pending' } });
  }),

  reviewTray: permissionProcedure('manage_files').query(async ({ ctx }) => {
    return ctx.prisma.documentReview.findMany({
      where: { status: 'pending' },
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
      const review = await ctx.prisma.documentReview.findUnique({ where: { id: input.reviewId } });
      if (review === null) throw new TRPCError({ code: 'NOT_FOUND' });

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
      const doc = await ctx.prisma.document.create({
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
      return ctx.prisma.document.update({ where: { id }, data: omitUndefined(rest) });
    }),

  /** Delete a document: best-effort remove the bytes, then the metadata row. */
  delete: permissionProcedure('manage_files')
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.document.findUnique({ where: { id: input.id } });
      if (doc === null) throw new TRPCError({ code: 'NOT_FOUND' });

      try {
        await getStorageAdapter().deleteObject(doc.storageKey);
      } catch (e) {
        console.error('Storage delete failed (row will still be removed)', e);
      }

      await ctx.prisma.document.delete({ where: { id: input.id } });
      return { id: input.id };
    }),
});
