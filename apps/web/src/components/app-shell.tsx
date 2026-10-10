'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard,
  Building2,
  FolderKanban,
  ListChecks,
  FileStack,
  Inbox,
  CalendarClock,
  Bell,
  Users,
  LogOut,
  Download,
  Loader2,
} from 'lucide-react';
import { Button, cn } from '@orqafy/ui';
import { OrqafyWordmark } from '@/components/orqafy-wordmark';
import { APP_VERSION } from '@/lib/app-version';
import { trpc } from '@/trpc/react';
import { buildExportFilename, downloadJson } from '@/lib/download-json';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Field-first surface — gets the geofence-amber accent (DESIGN §4/§5). */
  field?: boolean;
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Building2 },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/tasks', label: 'My Tasks', icon: ListChecks, field: true },
  { href: '/files', label: 'Files', icon: FileStack },
  { href: '/review', label: 'Review', icon: Inbox },
  { href: '/leave', label: 'Leave', icon: CalendarClock },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings/users', label: 'Users & Roles', icon: Users },
];

export function AppShell({ userName, children }: { userName: string; children: ReactNode }) {
  const pathname = usePathname();
  const utils = trpc.useUtils();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleDownloadMyData() {
    setIsExporting(true);
    setExportError(null);
    try {
      const data = await utils.privacy.exportData.fetch({});
      downloadJson(data, buildExportFilename('orqafy-my-data'));
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Download failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex items-center px-6 py-5">
          <OrqafyWordmark size="md" />
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  item.field === true && active && 'bg-accent/15 text-accent-foreground',
                )}
              >
                <Icon />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {/* White-label footer (fleet standard): app version tag + Powerbyte credit link. */}
        <div className="mt-auto space-y-1 border-t px-6 py-4">
          <p className="font-mono text-xs text-muted-foreground">v{APP_VERSION}</p>
          <a
            href="https://www.powerbyteitsolutions.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Developed by Powerbyte IT Solutions
          </a>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-card px-4 sm:px-6">
          <span className="text-sm text-muted-foreground md:hidden">Orqafy</span>
          <div className="ml-auto flex items-center gap-3">
            {exportError !== null ? (
              <span className="text-xs text-destructive">{exportError}</span>
            ) : null}
            <span className="text-sm font-medium">{userName}</span>
            <Button
              variant="ghost"
              size="icon"
              title="Download my data"
              aria-label="Download my data"
              disabled={isExporting}
              onClick={() => void handleDownloadMyData()}
            >
              {isExporting ? <Loader2 className="animate-spin" /> : <Download />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Sign out"
              aria-label="Sign out"
              onClick={() => void signOut({ callbackUrl: '/login' })}
            >
              <LogOut />
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
