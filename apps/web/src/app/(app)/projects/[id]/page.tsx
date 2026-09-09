'use client';

// Project detail + kanban board. The board renders the themed @orqafy/ui
// KanbanBoard (Kibo wrapper); live drag-drop + realtime board updates (D-22) are
// wired on top of tasks.move + the notification/board WS seam in a follow-up.
import { useParams } from 'next/navigation';
import { Plus, Pencil, MapPin } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, KanbanBoard } from '@orqafy/ui';
import type { KanbanColumn } from '@orqafy/ui';
import { TaskStatus } from '@orqafy/db';
import { trpc } from '@/trpc/react';
import { TaskFormDialog } from '@/components/forms/task-form';
import { MilestoneFormDialog } from '@/components/forms/milestone-form';

// Board columns keyed by the Prisma-native TaskStatus values (`in_progress`).
const COLUMNS: { id: string; title: string }[] = [
  { id: 'todo', title: 'To do' },
  { id: 'in_progress', title: 'In progress' },
  { id: 'blocked', title: 'Blocked' },
  { id: 'done', title: 'Done' },
];

interface RawLocation {
  lat: number;
  lng: number;
  radiusMeters: number;
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const project = trpc.projects.byId.useQuery({ id: params.id }, { enabled: params.id !== '' });
  const data = project.data;

  const utils = trpc.useUtils();
  // Live board updates (D-22): re-fetch the project when any task/board change
  // for this project streams over the SSE subscription transport.
  trpc.tasks.onBoardChanged.useSubscription(
    { projectId: params.id },
    {
      onData: () => {
        void utils.projects.byId.invalidate({ id: params.id });
      },
    },
  );
  // Cross-column drag → tasks.move, with an optimistic board update + rollback.
  const move = trpc.tasks.move.useMutation({
    async onMutate(vars) {
      const key = { id: params.id };
      await utils.projects.byId.cancel(key);
      const previous = utils.projects.byId.getData(key);
      utils.projects.byId.setData(key, (prev) => {
        if (prev == null) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((task) =>
            task.id === vars.id ? { ...task, status: vars.status } : task,
          ),
        };
      });
      return { previous };
    },
    onError(_err, _vars, context) {
      if (context?.previous !== undefined) {
        utils.projects.byId.setData({ id: params.id }, context.previous);
      }
    },
    onSettled() {
      void utils.projects.byId.invalidate({ id: params.id });
    },
  });

  const columns: KanbanColumn[] =
    data === undefined || data === null
      ? []
      : COLUMNS.map((col) => ({
          id: col.id,
          title: col.title,
          cards: data.tasks
            .filter((task) => task.status === col.id)
            .map((task) => {
              const meta = task.assignee?.name;
              return meta != null && meta !== ''
                ? { id: task.id, title: task.title, meta }
                : { id: task.id, title: task.title };
            }),
        }));

  return (
    <div className="space-y-6">
      {data === undefined || data === null ? (
        <p className="text-sm text-muted-foreground">Loading project…</p>
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
            <p className="text-sm text-muted-foreground">
              {data.client.name} · <span className="font-mono">{data.code}</span> · {data.status}
            </p>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Board</CardTitle>
              <TaskFormDialog
                projectId={data.id}
                trigger={
                  <Button size="sm">
                    <Plus /> New task
                  </Button>
                }
              />
            </CardHeader>
            <CardContent>
              <KanbanBoard
                columns={columns}
                onCardMove={(cardId, toColumnId) =>
                  move.mutate({ id: cardId, status: toColumnId as TaskStatus })
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {data.tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks yet.</p>
              ) : (
                data.tasks.map((task) => {
                  const location = (task.location as RawLocation | null) ?? null;
                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {location !== null ? (
                          <MapPin className="!size-3 shrink-0 text-accent-foreground" />
                        ) : null}
                        <span className="truncate text-sm">{task.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {task.status} · {task.priority}
                        </span>
                      </div>
                      <TaskFormDialog
                        projectId={data.id}
                        task={{
                          id: task.id,
                          title: task.title,
                          description: task.description,
                          assigneeId: task.assigneeId,
                          status: task.status,
                          priority: task.priority,
                          dueDate: task.dueDate,
                          location,
                          geofenceActiveFrom: task.geofenceActiveFrom,
                          geofenceActiveUntil: task.geofenceActiveUntil,
                        }}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={`Edit ${task.title}`}>
                            <Pencil />
                          </Button>
                        }
                      />
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Milestones</CardTitle>
              <MilestoneFormDialog
                projectId={data.id}
                trigger={
                  <Button size="sm">
                    <Plus /> New milestone
                  </Button>
                }
              />
            </CardHeader>
            <CardContent className="space-y-1">
              {data.milestones.length === 0 ? (
                <p className="text-sm text-muted-foreground">No milestones yet.</p>
              ) : (
                data.milestones.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm">{m.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {m.status}
                        {m.targetDate != null
                          ? ` · ${new Date(m.targetDate).toLocaleDateString()}`
                          : ''}
                      </span>
                    </div>
                    <MilestoneFormDialog
                      projectId={data.id}
                      milestone={{
                        id: m.id,
                        title: m.title,
                        status: m.status,
                        targetDate: m.targetDate,
                      }}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label={`Edit ${m.title}`}>
                          <Pencil />
                        </Button>
                      }
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
