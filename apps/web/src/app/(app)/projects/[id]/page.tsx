'use client';

// Project detail + kanban board. The board renders the themed @orqafy/ui
// KanbanBoard (Kibo wrapper); live drag-drop + realtime board updates (D-22) are
// wired on top of tasks.move + the notification/board WS seam in a follow-up.
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, KanbanBoard } from '@orqafy/ui';
import type { KanbanColumn } from '@orqafy/ui';
import { trpc } from '@/trpc/react';

// Board columns keyed by the Prisma-native TaskStatus values (`in_progress`).
const COLUMNS: { id: string; title: string }[] = [
  { id: 'todo', title: 'To do' },
  { id: 'in_progress', title: 'In progress' },
  { id: 'blocked', title: 'Blocked' },
  { id: 'done', title: 'Done' },
];

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
            <CardHeader>
              <CardTitle>Board</CardTitle>
            </CardHeader>
            <CardContent>
              <KanbanBoard columns={columns} />
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
