'use client';

// Apply-for-leave + my requests (D-21, DESIGN: Mobile First self-service).
// Leave only — no attendance/payroll. `reason` never requires health detail.
import { useState, type FormEvent } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@orqafy/ui';
import { trpc } from '@/trpc/react';

export default function LeavePage() {
  const utils = trpc.useUtils();
  const types = trpc.leave.types.useQuery();
  const requests = trpc.leave.myRequests.useQuery();
  const apply = trpc.leave.submitRequest.useMutation({
    onSuccess: () => void utils.leave.myRequests.invalidate(),
  });

  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (leaveTypeId === '' || start === '' || end === '') return;
    apply.mutate({ leaveTypeId, startDate: new Date(start), endDate: new Date(end) });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Leave</h1>

      <Card>
        <CardHeader>
          <CardTitle>Apply for leave</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={leaveTypeId}
                onChange={(e) => setLeaveTypeId(e.target.value)}
              >
                <option value="">Select…</option>
                {types.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="start">Start</Label>
              <Input
                id="start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">End</Label>
              <Input id="end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={apply.isPending}>
                Submit request
              </Button>
            </div>
          </form>
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
  );
}
