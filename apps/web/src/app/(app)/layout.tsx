import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AppShell } from '@/components/app-shell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (session === null) redirect('/login');

  const userName = session.user.name ?? session.user.email ?? 'User';
  return <AppShell userName={userName}>{children}</AppShell>;
}
