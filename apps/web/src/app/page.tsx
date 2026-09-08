import { redirect } from 'next/navigation';
import { prisma } from '@orqafy/db';
import { auth } from '@/auth';

// Entry router: first-run → /setup, unauthenticated → /login, else → /dashboard.
export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const users = await prisma.user.count();
  if (users === 0) redirect('/setup');

  const session = await auth();
  if (session === null) redirect('/login');

  redirect('/dashboard');
}
