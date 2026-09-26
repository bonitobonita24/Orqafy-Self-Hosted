// Site photos (D-28, ORQ-23). Bytes are uploaded first via POST /api/photos
// (which stores them at the deterministic key `photos/<clientId>/photo.<ext>`);
// this router commits the metadata row.
//
// Authorization is task-scoped: `upload_photo` alone is not enough — the caller
// must be the task's assignee. The storageKey must be exactly the key derived
// from the caller's own clientId, so a caller can never claim an object that
// someone else uploaded. `capturedBy` is always the authenticated caller.
// The commit is idempotent on `clientId` (the mobile outbox retries freely).
//
// NOTE: there is deliberately NO read procedure here yet. Photos carry GPS
// (location data) and task reads are unscoped today, so a photo read path must
// be assignee-or-oversight scoped when it is added (see docs/TASK_QUEUE.md).
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { isValidPhotoKey } from '@orqafy/storage';
import { router, permissionProcedure } from '../trpc';
import { PHOTO_FORBIDDEN_MESSAGE, canAttachPhoto } from '../photo-policy';

export const photosRouter = router({
  create: permissionProcedure('upload_photo')
    .input(
      z.object({
        clientId: z.string().uuid(),
        taskId: z.string().min(1),
        storageKey: z.string().min(1),
        capturedAt: z.date(),
        gpsLat: z.number().min(-90).max(90).optional(),
        gpsLng: z.number().min(-180).max(180).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // One canonical form so an upper/lower-case retry hits the same row + key.
      const clientId = input.clientId.toLowerCase();

      const task = await ctx.prisma.task.findUnique({
        where: { id: input.taskId },
        select: { id: true, assigneeId: true },
      });
      if (!canAttachPhoto(task, ctx.userId)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: PHOTO_FORBIDDEN_MESSAGE });
      }

      if (!isValidPhotoKey(input.storageKey, clientId)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'storageKey does not match this photo’s clientId.',
        });
      }

      // Upsert by clientId: a retry returns the existing row unchanged (the
      // first commit wins; nothing on it is re-writable by a replay).
      return ctx.prisma.photo.upsert({
        where: { clientId },
        update: {},
        create: {
          clientId,
          storageKey: input.storageKey,
          taskId: input.taskId,
          capturedBy: ctx.userId,
          capturedAt: input.capturedAt,
          gpsLat: input.gpsLat ?? null,
          gpsLng: input.gpsLng ?? null,
        },
      });
    }),
});
