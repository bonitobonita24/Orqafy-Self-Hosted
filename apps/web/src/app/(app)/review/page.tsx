'use client';

// Review tray (D-13). Human triage of the auto-filer's low-confidence document
// suggestions. Rows come from `documents.reviewTray` (gated by `manage_files` —
// a FORBIDDEN error renders a friendly card, never a crash). Each row can be
// CONFIRMED (accept the suggestion as-is) or REASSIGNED (an inline form picks a
// project / client / category, prefilled from the suggestion). Any decision
// invalidates the tray, the file list, the unsorted count, and the dashboard
// summary (its pending-review badge). Style mirrors files/page.tsx.
import { useState } from 'react';
import { Check, Inbox } from 'lucide-react';
import type { inferRouterOutputs } from '@trpc/server';
import { documentCategoryEnum, type DocumentCategory } from '@orqafy/shared';
import { Button, Card, CardContent, CardHeader, CardTitle, Label, Select } from '@orqafy/ui';
import type { AppRouter } from '@/server/root';
import { trpc } from '@/trpc/react';
import { documentCategoryLabel } from '@/components/forms/document-form';

type ReviewRow = inferRouterOutputs<AppRouter>['documents']['reviewTray'][number];

const DOCUMENT_CATEGORIES = documentCategoryEnum.options;

/** A trailing-comma-safe empty-string → undefined coercion for optional ids. */
function blankToUndef(value: string): string | undefined {
  return value === '' ? undefined : value;
}

function ReviewRowCard({ row }: { row: ReviewRow }) {
  const utils = trpc.useUtils();
  const decide = trpc.documents.decideReview.useMutation();

  const [reassigning, setReassigning] = useState(false);
  const [projectId, setProjectId] = useState(row.suggestedProjectId ?? '');
  const [clientId, setClientId] = useState(row.suggestedClientId ?? '');
  const [category, setCategory] = useState<string>(row.suggestedCategory ?? '');

  // Option lists load only once the row enters reassign mode.
  const projects = trpc.projects.list.useQuery(undefined, { enabled: reassigning });
  const clients = trpc.clients.list.useQuery(undefined, { enabled: reassigning });

  const confidencePct = Math.round(row.confidence * 100);

  async function invalidateAll() {
    await Promise.all([
      utils.documents.reviewTray.invalidate(),
      utils.documents.list.invalidate(),
      utils.documents.unsortedCount.invalidate(),
      utils.dashboard.summary.invalidate(),
    ]);
  }

  async function onConfirm() {
    await decide.mutateAsync({
      reviewId: row.id,
      status: 'confirmed',
      projectId: row.suggestedProjectId ?? undefined,
      clientId: row.suggestedClientId ?? undefined,
      category: row.suggestedCategory ?? undefined,
    });
    await invalidateAll();
  }

  async function onReassign() {
    await decide.mutateAsync({
      reviewId: row.id,
      status: 'reassigned',
      projectId: blankToUndef(projectId),
      clientId: blankToUndef(clientId),
      category: category === '' ? undefined : (category as DocumentCategory),
    });
    await invalidateAll();
  }

  return (
    <div className="space-y-3 rounded-md border border-border/60 px-3 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1 truncate font-medium">{row.file.name}</span>
        <span className="text-muted-foreground">{documentCategoryLabel(row.file.category)}</span>
        <span className="rounded-full bg-warning/15 px-2 py-0.5 font-mono text-xs font-medium text-warning">
          {confidencePct}%
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Suggested:</span>
        {row.suggestedProject ? <span>Project · {row.suggestedProject.name}</span> : null}
        {row.suggestedClient ? <span>Client · {row.suggestedClient.name}</span> : null}
        {row.suggestedCategory ? (
          <span>Category · {documentCategoryLabel(row.suggestedCategory)}</span>
        ) : null}
        {row.suggestedProject === null &&
        row.suggestedClient === null &&
        row.suggestedCategory === null ? (
          <span>No placement suggested.</span>
        ) : null}
      </div>

      {reassigning ? (
        <div className="space-y-3 rounded-md border border-border/60 bg-muted/30 px-3 py-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor={`project-${row.id}`}>Project</Label>
              <Select
                id={`project-${row.id}`}
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">None</option>
                {projects.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`client-${row.id}`}>Client</Label>
              <Select
                id={`client-${row.id}`}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">None</option>
                {clients.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`category-${row.id}`}>Category</Label>
              <Select
                id={`category-${row.id}`}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">None</option>
                {DOCUMENT_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {documentCategoryLabel(value)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {decide.error ? (
            <p className="text-sm text-destructive">
              {decide.error.message || 'Something went wrong. Please try again.'}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={decide.isPending}
              onClick={() => void onReassign()}
            >
              {decide.isPending ? 'Saving…' : 'Save reassignment'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setReassigning(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" disabled={decide.isPending} onClick={() => void onConfirm()}>
            <Check /> {decide.isPending ? 'Saving…' : 'Confirm'}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setReassigning(true)}>
            Reassign
          </Button>
          {decide.error && !reassigning ? (
            <span className="text-xs text-destructive">
              {decide.error.message || 'Something went wrong.'}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function ReviewPage() {
  const tray = trpc.documents.reviewTray.useQuery();
  const forbidden = tray.error?.data?.code === 'FORBIDDEN';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Inbox className="text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">Review</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documents awaiting review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tray.error ? (
            <p className="text-sm text-muted-foreground">
              {forbidden
                ? "You don't have permission to review files."
                : 'Could not load the review tray. Please try again.'}
            </p>
          ) : tray.data === undefined ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : tray.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents awaiting review.</p>
          ) : (
            tray.data.map((row) => <ReviewRowCard key={row.id} row={row} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
