'use client';

// Admin "export this user's data" action (DPA W8 — on-behalf-of export,
// gated server-side by `manage_users`, see `privacy.ts#exportData`). Mirrors
// the self-export flow in `app-shell.tsx#handleDownloadMyData`: fetch via the
// tRPC utils client (not a subscribed query — this is an on-demand download,
// not UI state), trigger a browser download, surface any failure inline
// (there is no toast system in this app).
import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@orqafy/ui';
import { trpc } from '@/trpc/react';
import { buildExportFilename, downloadJson } from '@/lib/download-json';

export function UserExportButton({ userId, userEmail }: { userId: string; userEmail: string }) {
  const utils = trpc.useUtils();
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setIsExporting(true);
    setError(null);
    try {
      const data = await utils.privacy.exportData.fetch({ userId });
      downloadJson(data, buildExportFilename(`orqafy-user-${userId}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Export data for ${userEmail}`}
        title="Export data"
        disabled={isExporting}
        onClick={() => void handleExport()}
      >
        {isExporting ? <Loader2 className="animate-spin" /> : <Download />}
      </Button>
      {error !== null ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
