'use client';

// Project detail + kanban board. The board renders the themed @orqafy/ui
// KanbanBoard (Kibo wrapper); live drag-drop + realtime board updates (D-22) are
// wired on top of tasks.move + the notification/board WS seam in a follow-up.
import { useParams } from 'next/navigation';
import { Plus, Pencil, MapPin } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, KanbanBoard } from '@orqafy/ui';
import type { KanbanColumn } from '@orqafy/ui';
import { trpc } from '@/trpc/react';
import { TaskFormDialog } from '@/components/forms/task-form';

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
              <KanbanBoard columns={columns} />
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
            <CardHeader>
              <CardTitle>Milestones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.milestones.length === 0 ? (
                <p className="text-sm text-muted-foreground">No milestones yet.</p>
              ) : (
                data.milestones.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-sm">
                    <span>{m.title}</span>
                    <span className="text-muted-foreground">{m.status}</span>
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
