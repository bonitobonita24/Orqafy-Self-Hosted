// Tasks — board work + geofenced "site tasks" (D-19). The geofence anchor
// (location + active window) lives on the Task; presence is evaluated ON-DEVICE
// by the mobile app, and NO location history is stored (D-19). Mutations publish
// realtime events so the web board/notifications update live (D-22 seam).
import { z } from 'zod';
import { Prisma, TaskStatus } from '@orqafy/db';
import { taskPriorityEnum, locationSchema } from '@orqafy/shared';
import { observable } from '@trpc/server/observable';
import { router, protectedProcedure } from '../trpc';
import { omitUndefined } from '../util';
import { realtimeBus } from '../realtime';
import { canViewTaskPhotos } from '../photo-policy';

// Prisma-native status enum (values `in_progress`; the DB stores `in-progress`
// via @map). Keeps the tRPC contract 1:1 with the DB layer.
const taskStatus = z.nativeEnum(TaskStatus);

const geofenceFields = {
  location: locationSchema.optional(),
  geofenceActiveFrom: z.date().optional(),
  geofenceActiveUntil: z.date().optional(),
};

function locationData(location: z.infer<typeof locationSchema> | undefined): {
  location?: Prisma.InputJsonValue;
} {
  return location === undefined ? {} : { location };
}

export const tasksRouter = router({
  listByProject: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.task.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: 'asc' },
        include: { assignee: { select: { id: true, name: true } } },
      });
    }),

  /** The signed-in user's assigned tasks, split into due-soon vs overdue. */
  myTasks: protectedProcedure.query(async ({ ctx }) => {
    const tasks = await ctx.prisma.task.findMany({
      where: { assigneeId: ctx.userId, status: { not: 'done' } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      include: { project: { select: { id: true, name: true, code: true } } },
    });
    const now = Date.now();
    let overdue = 0;
    let due = 0;
    for (const task of tasks) {
      if (task.dueDate !== null && task.dueDate.getTime() < now) overdue += 1;
      else due += 1;
    }
    return { tasks, counts: { overdue, due, total: tasks.length } };
  }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const task = await ctx.prisma.task.findUnique({
        where: { id: input.id },
        include: {
          project: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
        },
      });
      if (task === null) return null;
      // Photo rows carry GPS: only the assignee or an oversight holder sees them
      // (F2). storageKey/clientId are never returned — no web consumer needs
      // them, and a known clientId is the handle for tampering with an upload.
      const photos = canViewTaskPhotos(task, ctx.userId, ctx.permissions)
        ? await ctx.prisma.photo.findMany({
            where: { taskId: task.id },
            orderBy: { capturedAt: 'desc' },
            select: {
              id: true,
              capturedAt: true,
              capturedBy: true,
              gpsLat: true,
              gpsLng: true,
            },
          })
        : [];
      return { ...task, photos };
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        projectId: z.string().min(1),
        description: z.string().optional(),
        assigneeId: z.string().min(1).optional(),
        status: taskStatus.default(TaskStatus.todo),
        priority: taskPriorityEnum.default('medium'),
        dueDate: z.date().optional(),
        boardColumn: z.string().optional(),
        ...geofenceFields,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.prisma.task.create({
        data: {
          title: input.title,
          projectId: input.projectId,
          status: input.status,
          priority: input.priority,
          createdBy: ctx.userId,
          ...omitUndefined({
            description: input.description,
            assigneeId: input.assigneeId,
            dueDate: input.dueDate,
            boardColumn: input.boardColumn,
            geofenceActiveFrom: input.geofenceActiveFrom,
            geofenceActiveUntil: input.geofenceActiveUntil,
          }),
          ...locationData(input.location),
        },
      });
      realtimeBus.emit('board:changed', { projectId: task.projectId });
      return task;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        assigneeId: z.string().min(1).optional(),
        priority: taskPriorityEnum.optional(),
        dueDate: z.date().optional(),
        ...geofenceFields,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, location, ...rest } = input;
      const task = await ctx.prisma.task.update({
        where: { id },
        data: { ...omitUndefined(rest), ...locationData(location) },
      });
      realtimeBus.emit('task:updated', { projectId: task.projectId, taskId: task.id });
      return task;
    }),

  /** Move a card between board columns / statuses (kanban drag-drop target). */
  move: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        status: taskStatus,
        boardColumn: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.prisma.task.update({
        where: { id: input.id },
        data: { status: input.status, ...omitUndefined({ boardColumn: input.boardColumn }) },
      });
      realtimeBus.emit('board:changed', { projectId: task.projectId });
      realtimeBus.emit('task:updated', { projectId: task.projectId, taskId: task.id });
      return task;
    }),

  /**
   * Live board feed for one project (D-22). Streams a lightweight signal on any
   * board/task change so the client re-fetches. Carried over SSE via
   * httpSubscriptionLink. Mirrors notifications.onNew.
   */
  onBoardChanged: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .subscription(({ input }) =>
      observable<{ projectId: string }>((emit) => {
        const offBoard = realtimeBus.on('board:changed', (payload) => {
          if (payload.projectId === input.projectId) emit.next({ projectId: payload.projectId });
        });
        const offTask = realtimeBus.on('task:updated', (payload) => {
          if (payload.projectId === input.projectId) emit.next({ projectId: payload.projectId });
        });
        return () => {
          offBoard();
          offTask();
        };
      }),
    ),
});
