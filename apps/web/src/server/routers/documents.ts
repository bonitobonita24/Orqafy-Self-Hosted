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
import { router, protectedProcedure, permissionProcedure } from '../trpc';
import { omitUndefined } from '../util';

export const documentsRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          projectId: z.string().min(1).optional(),
          category: documentCategoryEnum.optional(),
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
});
