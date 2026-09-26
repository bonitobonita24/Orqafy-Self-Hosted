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
// READ PATHS: photo rows carry GPS, so every read is scoped by photo-policy —
// tasks.byId returns a task's photos only to the assignee or an oversight
// holder (canViewTaskPhotos), and dashboard.summary's recent-photo feed is
// oversight-only (canViewPhotoFeed). Neither returns clientId/storageKey.
// There is no photo byte-serving path (see the F4 note in server/photo-upload).
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

      // Idempotent on clientId: a retry by the SAME user returns the existing
      // row unchanged (first commit wins; a replay rewrites nothing). A row owned
      // by ANOTHER user is refused with the uniform message — never returned
      // (that would leak their GPS/storageKey to anyone who learns the clientId).
      const existing = await ctx.prisma.photo.findUnique({ where: { clientId } });
      if (existing !== null) return ownedOrForbidden(existing, ctx.userId);

      try {
        return await ctx.prisma.photo.create({
          data: {
            clientId,
            storageKey: input.storageKey,
            taskId: input.taskId,
            capturedBy: ctx.userId,
            capturedAt: input.capturedAt,
            gpsLat: input.gpsLat ?? null,
            gpsLng: input.gpsLng ?? null,
          },
        });
      } catch (err) {
        // Concurrent commit of the same clientId (e.g. two outbox drains): the
        // unique constraint fires — re-read and apply the same owner rule.
        if (!isUniqueViolation(err)) throw err;
        const raced = await ctx.prisma.photo.findUnique({ where: { clientId } });
        if (raced === null) throw err;
        return ownedOrForbidden(raced, ctx.userId);
      }
    }),
});

function ownedOrForbidden<T extends { capturedBy: string }>(row: T, userId: string): T {
  if (row.capturedBy !== userId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: PHOTO_FORBIDDEN_MESSAGE });
  }
  return row;
}

/** Prisma unique-constraint violation (P2002), duck-typed so tests need no client. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 'P2002'
  );
}
