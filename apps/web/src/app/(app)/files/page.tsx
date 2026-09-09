'use client';

// Files (D-13). Upload + metadata management surface. Bytes upload via
// /api/media (server-proxied StorageAdapter) then commit through documents.create;
// listing/edit/delete are metadata operations. `isSPI` docs (payroll/HR) only
// appear for callers with finance sight (server-gated, D-20) and carry a
// "Restricted" badge. The unsorted-review count badge is preserved.
import { useState } from 'react';
import { Download, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@orqafy/ui';
import { trpc } from '@/trpc/react';
import { DocumentFormDialog, documentCategoryLabel } from '@/components/forms/document-form';

/** Format a byte count into a compact human string. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function DeleteDocumentButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const del = trpc.documents.delete.useMutation();

  async function onDelete() {
    await del.mutateAsync({ id });
    await Promise.all([
      utils.documents.list.invalidate(),
      utils.documents.unsortedCount.invalidate(),
    ]);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Delete ${name}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete document</DialogTitle>
          <DialogDescription>
            Delete “{name}”? This removes the file and its metadata and cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {del.error ? (
          <p className="text-sm text-destructive">
            {del.error.message || 'Delete failed. Please try again.'}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={del.isPending}
            onClick={() => void onDelete()}
          >
            {del.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function FilesPage() {
  const docs = trpc.documents.list.useQuery();
  const unsorted = trpc.documents.unsortedCount.useQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Files</h1>
        {unsorted.data !== undefined && unsorted.data > 0 ? (
          <span className="rounded-full bg-warning/15 px-3 py-1 text-xs font-medium text-warning">
            {unsorted.data} awaiting review
          </span>
        ) : null}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle>Documents</CardTitle>
          <DocumentFormDialog
            trigger={
              <Button>
                <Plus /> Upload document
              </Button>
            }
          />
        </CardHeader>
        <CardContent className="space-y-2">
          {docs.data === undefined ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : docs.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents yet.</p>
          ) : (
            docs.data.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{doc.name}</span>
                {doc.isSPI ? (
                  <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                    Restricted
                  </span>
                ) : null}
                <span className="text-muted-foreground">{documentCategoryLabel(doc.category)}</span>
                {doc.project ? (
                  <span className="text-muted-foreground">{doc.project.name}</span>
                ) : null}
                <span className="font-mono text-xs text-muted-foreground">
                  {formatBytes(doc.size)}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/api/media/${doc.id}`} aria-label={`Download ${doc.name}`}>
                      <Download /> Download
                    </a>
                  </Button>
                  <DocumentFormDialog
                    document={doc}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label={`Edit ${doc.name}`}>
                        <Pencil />
                      </Button>
                    }
                  />
                  <DeleteDocumentButton id={doc.id} name={doc.name} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
