// Home dashboard aggregate (D-22): active projects + %, my tasks due/overdue,
// recent site photos, unsorted-documents count, pending leave approvals (only for
// approvers). The v2 finance strip is intentionally absent.
import { router, protectedProcedure } from '../trpc';

export const dashboardRouter = router({
  summary: protectedProcedure.query(async ({ ctx }) => {
    const now = Date.now();
    const canApproveLeave = ctx.permissions.has('approve_leave');

    const [activeProjects, myOpenTasks, recentPhotos, unsortedDocs, pendingLeave] =
      await Promise.all([
        ctx.prisma.project.findMany({
          where: { status: 'active' },
          orderBy: { updatedAt: 'desc' },
          take: 8,
          select: { id: true, name: true, code: true, progressPct: true },
        }),
        ctx.prisma.task.findMany({
          where: { assigneeId: ctx.userId, status: { not: 'done' } },
          select: { id: true, title: true, dueDate: true, projectId: true },
        }),
        ctx.prisma.photo.findMany({
          orderBy: { capturedAt: 'desc' },
          take: 6,
          select: { id: true, storageKey: true, capturedAt: true, taskId: true },
        }),
        ctx.prisma.documentReview.count({ where: { status: 'pending' } }),
        canApproveLeave
          ? ctx.prisma.leaveRequest.count({ where: { status: 'pending' } })
          : Promise.resolve(0),
      ]);

    let overdue = 0;
    let due = 0;
    for (const task of myOpenTasks) {
      if (task.dueDate !== null && task.dueDate.getTime() < now) overdue += 1;
      else due += 1;
    }

    return {
      activeProjects,
      myTasks: { overdue, due, total: myOpenTasks.length },
      recentPhotos,
      unsortedDocsCount: unsortedDocs,
      pendingLeaveApprovals: canApproveLeave ? pendingLeave : null,
    };
  }),
});
