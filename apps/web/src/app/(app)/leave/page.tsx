'use client';

// Leave (D-21, DESIGN: Mobile First self-service). Apply-for-leave + my balances
// + my requests for every user; a "Leave approvals" surface for users with the
// `approve_leave` permission (approve/reject pending requests). Leave only — no
// attendance/payroll. `reason` never requires health detail (SPI minimisation).
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@orqafy/ui';
import { trpc } from '@/trpc/react';
import { LeaveApplyForm } from '@/components/forms/leave-form';

function LeaveApprovals() {
  const utils = trpc.useUtils();
  const pending = trpc.leave.pendingApprovals.useQuery();
  const decide = trpc.leave.decide.useMutation({
    onSuccess: () => void utils.leave.pendingApprovals.invalidate(),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leave approvals</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {pending.data === undefined ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : pending.data.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No requests awaiting a decision.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead className="text-right">Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.user.name}</TableCell>
                  <TableCell>{r.leaveType.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.startDate.toLocaleDateString()} – {r.endDate.toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ id: r.id, approve: true })}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ id: r.id, approve: false })}
                      >
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function LeavePage() {
  const me = trpc.auth.me.useQuery();
  const balances = trpc.leave.myBalances.useQuery();
  const requests = trpc.leave.myRequests.useQuery();
  const canApprove = me.data?.permissions.includes('approve_leave') ?? false;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Leave</h1>

      <Card>
        <CardHeader>
          <CardTitle>Apply for leave</CardTitle>
        </CardHeader>
        <CardContent>
          <LeaveApplyForm />
        </CardContent>
      </Card>

      {canApprove ? <LeaveApprovals /> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>My balances</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {balances.data === undefined ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : balances.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leave balances yet.</p>
            ) : (
              balances.data.map((b) => (
                <div key={b.id} className="flex items-center justify-between text-sm">
                  <span>
                    {b.leaveType.name} <span className="text-muted-foreground">· {b.year}</span>
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {b.remaining} / {b.entitled} left
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {requests.data === undefined ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : requests.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leave requests yet.</p>
            ) : (
              requests.data.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span>
                    {r.leaveType.name} · {r.startDate.toLocaleDateString()} –{' '}
                    {r.endDate.toLocaleDateString()}
                  </span>
                  <span className="text-muted-foreground">{r.status}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
