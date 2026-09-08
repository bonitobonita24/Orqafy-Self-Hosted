'use client';

// Notification center (DESIGN: Mobile First — checked on phone). Live updates
// arrive over the WS seam (notifications.onNew) once the Part-7 transport lands.
import { Button, Card, CardContent } from '@orqafy/ui';
import { trpc } from '@/trpc/react';

export default function NotificationsPage() {
  const utils = trpc.useUtils();
  const list = trpc.notifications.list.useQuery();
  const markAll = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => void utils.notifications.list.invalidate(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <Button variant="outline" size="sm" onClick={() => markAll.mutate()}>
          Mark all read
        </Button>
      </div>

      <div className="space-y-2">
        {list.data === undefined ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : list.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">You're all caught up.</p>
        ) : (
          list.data.map((n) => (
            <Card key={n.id} className={n.isRead ? 'opacity-60' : undefined}>
              <CardContent className="flex items-center justify-between p-4 text-sm">
                <span className="font-medium">{n.type}</span>
                <span className="text-muted-foreground">{n.createdAt.toLocaleString()}</span>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
