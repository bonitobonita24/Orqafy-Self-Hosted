// Right-to-access/portability data export (DPA W4, Rule 33 / `.ai_prompt/privacy.md`
// dsr.access / dsr.port). Self-export is always allowed. Exporting ANOTHER
// user's data is a controller/admin action (on-behalf-of a data subject) and
// requires `manage_users` — the same gate `users.erase` uses — not the
// broader `export_data` (which project_manager/accountant hold by default and
// is meant for the caller's OWN data, not another subject's). The response
// NEVER carries `passwordHash` or file bytes — documents/photos carry only
// their `storageKey` (the bytes live in object storage).
//
// SPI document metadata is included ONLY when the caller holds
// `view_finances` — NO uploader/subject exemption — mirroring the exact gate
// `routers/documents.ts` uses (`isSPI && !ctx.permissions.has('view_finances')`
// => excluded), even for a user exporting documents they themselves uploaded.
//
// Photos (GPS-bearing) on an on-behalf export are included only when the
// caller also holds photo-oversight per `photo-policy.ts#canViewPhotoFeed`
// (the same oversight gate the cross-task photo feed uses) — `manage_users`
// alone does not imply site-photo oversight. Self export always gets the
// subject's own captured photos.
import { TRPCError } from '@trpc/server';
import { dataExportPayloadSchema, dataExportRequestSchema } from '@orqafy/shared';
import { router, protectedProcedure } from '../trpc';
import { writeAudit } from '../audit';
import { canViewPhotoFeed } from '../photo-policy';

export const privacyRouter = router({
  exportData: protectedProcedure.input(dataExportRequestSchema).query(async ({ ctx, input }) => {
    const targetId = input.userId ?? ctx.userId;
    const isOnBehalf = targetId !== ctx.userId;

    if (isOnBehalf && !ctx.permissions.has('manage_users')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Missing required permission(s): manage_users',
      });
    }

    const user = await ctx.prisma.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        role: { select: { name: true } },
      },
    });
    // Same NOT_FOUND response whether the id is missing or malformed — never
    // reveal which (data-exfiltration probing surface).
    if (user === null) throw new TRPCError({ code: 'NOT_FOUND' });

    // SPI gate — identical rule to documents.ts: view_finances only, no
    // subject/uploader exemption.
    const canSeeSPI = ctx.permissions.has('view_finances');
    // Photo-oversight gate for an on-behalf export — self export is always
    // the subject's own photos, no gate needed.
    const canSeePhotos = !isOnBehalf || canViewPhotoFeed(ctx.permissions);

    const [tasksCreated, tasksAssigned, documents, photos, leaveRequests, leaveBalances, notifications, auditLogs] =
      await Promise.all([
        ctx.prisma.task.findMany({
          where: { createdBy: targetId },
          select: { id: true, title: true, projectId: true, status: true, createdAt: true },
        }),
        ctx.prisma.task.findMany({
          where: { assigneeId: targetId },
          select: { id: true, title: true, projectId: true, status: true, createdAt: true },
        }),
        ctx.prisma.document.findMany({
          where: { uploadedBy: targetId, ...(canSeeSPI ? {} : { isSPI: false }) },
          select: { id: true, name: true, storageKey: true, category: true, createdAt: true },
        }),
        canSeePhotos
          ? ctx.prisma.photo.findMany({
              where: { capturedBy: targetId },
              select: {
                id: true,
                storageKey: true,
                taskId: true,
                milestoneId: true,
                capturedAt: true,
              },
            })
          : Promise.resolve([]),
        ctx.prisma.leaveRequest.findMany({
          where: { userId: targetId },
          select: {
            id: true,
            leaveTypeId: true,
            startDate: true,
            endDate: true,
            status: true,
            createdAt: true,
          },
        }),
        ctx.prisma.leaveBalance.findMany({
          where: { userId: targetId },
          select: { leaveTypeId: true, year: true, entitled: true, used: true, remaining: true },
        }),
        ctx.prisma.notification.findMany({
          where: { userId: targetId },
          select: { id: true, type: true, isRead: true, createdAt: true },
        }),
        ctx.prisma.auditLog.findMany({
          where: { userId: targetId },
          select: { id: true, action: true, targetType: true, targetId: true, timestamp: true },
        }),
      ]);

    const payload = dataExportPayloadSchema.parse({
      exportedAt: new Date(),
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        ...(user.phone !== null ? { phone: user.phone } : {}),
        isActive: user.isActive,
        roleName: user.role.name,
        createdAt: user.createdAt,
      },
      tasks: [...tasksCreated, ...tasksAssigned],
      documents,
      photos: photos.map((p) => ({
        id: p.id,
        storageKey: p.storageKey,
        ...(p.taskId !== null ? { taskId: p.taskId } : {}),
        ...(p.milestoneId !== null ? { milestoneId: p.milestoneId } : {}),
        capturedAt: p.capturedAt,
      })),
      leaveRequests,
      leaveBalances,
      notifications,
      auditLogs: auditLogs.map((a) => ({
        id: a.id,
        action: a.action,
        targetType: a.targetType,
        ...(a.targetId !== null ? { targetId: a.targetId } : {}),
        timestamp: a.timestamp,
      })),
    });

    await writeAudit(ctx.prisma, {
      userId: ctx.userId,
      action: 'data_subject.export',
      targetType: 'user',
      targetId,
      metadata: { byAdmin: isOnBehalf },
    });

    return payload;
  }),
});
