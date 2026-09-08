'use client';

// Files (D-13). Listing + the unsorted-review count. The drag-drop uploader
// (Kibo Dropzone → presigned PUT to MinIO/S3), OCR text, and the auto-filing
// confidence matcher are worker-driven and land with @orqafy/storage + jobs
// (Part 6) — this screen is the metadata/browse surface.
import { Card, CardContent, CardHeader, CardTitle } from '@orqafy/ui';
import { trpc } from '@/trpc/react';

export default function FilesPage() {
  const docs = trpc.documents.list.useQuery();
  const unsorted = trpc.documents.unsortedCount.useQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Files</h1>
        {unsorted.data !== undefined && unsorted.data > 0 ? (
          <span className="rounded-full bg-warning/15 px-3 py-1 text-xs font-medium text-warning">
            {unsorted.data} awaiting review
          </span>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {docs.data === undefined ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : docs.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents yet.</p>
          ) : (
            docs.data.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{doc.name}</span>
                <span className="text-muted-foreground">{doc.category}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
