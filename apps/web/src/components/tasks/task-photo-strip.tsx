'use client';

// Read-only site-photo thumbnails for a task (ORQ-32). Fetches the task's photo
// metadata via `tasks.byId` (which already scopes photos to assignee-or-oversight
// and NEVER returns storageKey) and renders each as a thumbnail served by the
// scoped byte route GET /api/photos/[id]. The image is a CSS-scaled original — a
// server resize pipeline is a post-v1 optimization. No storageKey is ever
// referenced (it is not returned by the query), and the byte route re-checks the
// same policy, so this component is a convenience view, not the auth boundary.
import { trpc } from '@/trpc/react';

/** Format a captured-at timestamp compactly, matching the dashboard's photo tiles. */
function capturedLabel(capturedAt: Date | string): string {
  return new Date(capturedAt).toLocaleString();
}

export function TaskPhotoStrip({ taskId }: { taskId: string }) {
  const query = trpc.tasks.byId.useQuery({ id: taskId });

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading photos…</p>;
  }
  if (query.isError) {
    return <p className="text-sm text-muted-foreground">Could not load photos.</p>;
  }

  const photos = query.data?.photos ?? [];
  if (photos.length === 0) {
    return <p className="text-sm text-muted-foreground">No photos.</p>;
  }

  return (
    <div className="flex flex-wrap gap-3">
      {photos.map((photo) => {
        const src = `/api/photos/${photo.id}`;
        const hasGps = photo.gpsLat != null;
        return (
          <a
            key={photo.id}
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col items-center gap-1"
            title={capturedLabel(photo.capturedAt)}
          >
            {/* Plain <img>: bytes come from the scoped app route /api/photos/[id],
                not the Next image optimizer (which cannot forward the auth cookie/bearer). */}
            <img
              src={src}
              alt="Site photo"
              loading="lazy"
              className="h-20 w-20 rounded border object-cover transition-opacity group-hover:opacity-90"
            />
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              {hasGps ? <span aria-label="Has location">📍</span> : null}
              {capturedLabel(photo.capturedAt)}
            </span>
          </a>
        );
      })}
    </div>
  );
}
