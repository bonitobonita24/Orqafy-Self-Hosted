// Right-to-access/portability data export (DPA W4, Rule 33 / `.ai_prompt/privacy.md`
// dsr.access / dsr.port). Self-export is always allowed; exporting ANOTHER
// user's data requires `export_data` (admin-on-behalf-of). The response NEVER
// carries `passwordHash` or file bytes — documents/photos carry only their
// `storageKey` (the bytes live in object storage). SPI document metadata is
// included only when the caller is the subject themself or holds
// `view_finances` — mirrors the exact gate `routers/documents.ts` uses
// (`isSPI && !ctx.permissions.has('view_finances')` => excluded).
import { TRPCError } from '@trpc/server';
import { dataExportPayloadSchema, dataExportRequestSchema } from '@orqafy/shared';
import { router, protectedProcedure } from '../trpc';
import { writeAudit } from '../audit';

export const privacyRouter = router({
  exportData: protectedProcedure.input(dataExportRequestSchema).query(async ({ ctx, input }) => {
    const targetId = input.userId ?? ctx.userId;

    if (targetId !== ctx.userId && !ctx.permissions.has('export_data')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Missing required permission(s): export_data',
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

    // SPI gate — identical rule to documents.ts: the subject exporting their
    // own data always sees their own SPI docs; an admin exporting on another
    // subject's behalf needs view_finances, same as reading one directly.
    const canSeeSPI = targetId === ctx.userId || ctx.permissions.has('view_finances');

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
        ctx.prisma.photo.findMany({
          where: { capturedBy: targetId },
          select: {
            id: true,
            storageKey: true,
            taskId: true,
            milestoneId: true,
            capturedAt: true,
          },
        }),
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
      metadata: { byAdmin: targetId !== ctx.userId },
    });

    return payload;
  }),
});
