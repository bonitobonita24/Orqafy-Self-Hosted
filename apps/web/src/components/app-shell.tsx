'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard,
  Building2,
  FolderKanban,
  ListChecks,
  FileStack,
  CalendarClock,
  Bell,
  Users,
  LogOut,
  MapPin,
} from 'lucide-react';
import { Button, cn } from '@orqafy/ui';

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
  { href: '/leave', label: 'Leave', icon: CalendarClock },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings/users', label: 'Users & Roles', icon: Users },
];

export function AppShell({ userName, children }: { userName: string; children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex items-center gap-2 px-6 py-5">
          <MapPin className="text-primary" />
          <span className="text-lg font-semibold tracking-tight">Orqafy</span>
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
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-card px-4 sm:px-6">
          <span className="text-sm text-muted-foreground md:hidden">Orqafy</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm font-medium">{userName}</span>
            <Button
              variant="ghost"
              size="icon"
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
