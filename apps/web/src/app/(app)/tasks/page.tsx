'use client';

// My Tasks — the field-staff primary surface (DESIGN: Mobile First). Big touch
// targets, geofenced tasks flagged with the amber location accent (§5). The
// on-device geofence engine lives in the Expo app; here it is a visual marker.
import Link from 'next/link';
import { MapPin, Clock } from 'lucide-react';
import { Card, CardContent } from '@orqafy/ui';
import { trpc } from '@/trpc/react';

function formatDue(due: Date | null): { label: string; overdue: boolean } {
  if (due === null) return { label: 'No due date', overdue: false };
  const overdue = due.getTime() < Date.now();
  return { label: due.toLocaleDateString(), overdue };
}

export default function MyTasksPage() {
  const myTasks = trpc.tasks.myTasks.useQuery();
  const data = myTasks.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Tasks</h1>
        {data !== undefined ? (
          <p className="text-sm text-muted-foreground">
            {data.counts.total} open · {data.counts.overdue} overdue
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        {data === undefined ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : data.tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing assigned to you right now.</p>
        ) : (
          data.tasks.map((task) => {
            const due = formatDue(task.dueDate);
            const geofenced = task.location !== null;
            return (
              <Card key={task.id}>
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{task.title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {task.project.name} · {task.priority}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-sm">
                    {geofenced ? (
                      <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-1 text-xs font-medium text-accent-foreground">
                        <MapPin className="!size-3" /> On site
                      </span>
                    ) : null}
                    <span
                      className={`flex items-center gap-1 ${due.overdue ? 'text-destructive' : 'text-muted-foreground'}`}
                    >
                      <Clock className="!size-3" /> {due.label}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        <Link href="/dashboard" className="hover:underline">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
