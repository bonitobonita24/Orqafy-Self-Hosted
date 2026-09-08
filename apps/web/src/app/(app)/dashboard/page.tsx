'use client';

// Home dashboard (D-22): active projects %, my tasks due/overdue, recent site
// photos, unsorted-documents count, pending leave approvals. Charts (shadcn
// Chart/Recharts) and the v2 finance strip are follow-ups; progress here uses
// lightweight token-styled bars per DESIGN §4 ("no gratuitous viz").
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, FileWarning, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@orqafy/ui';
import { trpc } from '@/trpc/react';

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string | undefined;
  icon: typeof AlertTriangle;
  tone?: 'default' | 'warning' | 'destructive';
}) {
  const toneClass =
    tone === 'destructive'
      ? 'text-destructive'
      : tone === 'warning'
        ? 'text-warning'
        : 'text-primary';
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`rounded-lg bg-muted p-2 ${toneClass}`}>
          <Icon />
        </div>
        <div>
          <p className="font-mono text-2xl font-semibold leading-none">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
          {hint !== undefined ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const summary = trpc.dashboard.summary.useQuery();
  const data = summary.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your projects and tasks at a glance.</p>
      </div>

      {summary.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data === undefined ? (
        <p className="text-sm text-destructive">Could not load the dashboard.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Tasks due"
              value={data.myTasks.due}
              icon={ClipboardList}
              hint={`${data.myTasks.total} assigned to you`}
            />
            <StatTile
              label="Overdue"
              value={data.myTasks.overdue}
              icon={AlertTriangle}
              tone="destructive"
            />
            <StatTile
              label="Unsorted documents"
              value={data.unsortedDocsCount}
              icon={FileWarning}
              tone="warning"
            />
            <StatTile
              label="Pending leave approvals"
              value={data.pendingLeaveApprovals ?? '—'}
              icon={CheckCircle2}
              hint={data.pendingLeaveApprovals === null ? 'Approver only' : undefined}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Active projects</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.activeProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active projects yet.</p>
              ) : (
                data.activeProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="block rounded-md p-2 transition-colors hover:bg-muted"
                  >
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{project.name}</span>
                      <span className="font-mono text-muted-foreground">
                        {project.progressPct}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${project.progressPct}%` }}
                      />
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent site photos</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recentPhotos.length === 0 ? (
                <p className="text-sm text-muted-foreground">No photos captured yet.</p>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                  {data.recentPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className="flex aspect-square items-center justify-center rounded-md border bg-muted text-[10px] text-muted-foreground"
                      title={photo.storageKey}
                    >
                      photo
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
