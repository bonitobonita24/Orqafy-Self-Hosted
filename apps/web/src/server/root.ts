// The Orqafy tRPC root router — the single AppRouter every client is typed
// against. `@orqafy/api-client` type-imports `AppRouter` from `@orqafy/web/server`
// (see server/index.ts) so the mobile/desktop apps get end-to-end type safety.
import { router } from './trpc';
import { setupRouter } from './routers/setup';
import { authRouter } from './routers/auth';
import { usersRouter, rolesRouter } from './routers/users';
import { clientsRouter } from './routers/clients';
import { projectsRouter } from './routers/projects';
import { tasksRouter } from './routers/tasks';
import { documentsRouter } from './routers/documents';
import { notificationsRouter } from './routers/notifications';
import { leaveRouter } from './routers/leave';
import { dashboardRouter } from './routers/dashboard';

export const appRouter = router({
  setup: setupRouter,
  auth: authRouter,
  users: usersRouter,
  roles: rolesRouter,
  clients: clientsRouter,
  projects: projectsRouter,
  tasks: tasksRouter,
  documents: documentsRouter,
  notifications: notificationsRouter,
  leave: leaveRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
