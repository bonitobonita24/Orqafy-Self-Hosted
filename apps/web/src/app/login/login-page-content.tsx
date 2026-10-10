'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@orqafy/ui';
import { OrqafyWordmark } from '@/components/orqafy-wordmark';
import { trpc } from '@/trpc/react';

export default function LoginPageContent() {
  const router = useRouter();
  // On a fresh install (no users yet) surface a direct link to first-run setup —
  // belt-and-suspenders alongside the root RSC's /setup redirect.
  const setupStatus = trpc.setup.status.useQuery();
  const needsSetup = setupStatus.data?.needsSetup === true;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (res?.error !== undefined && res.error !== null) {
      setError('Invalid email or password.');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <OrqafyWordmark size="lg" />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to Orqafy</CardTitle>
          <CardDescription>Use your Orqafy account for this install.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error !== null ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          {needsSetup ? (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              First time here?{' '}
              <Link href="/setup" className="font-medium text-primary hover:underline">
                Set up this install
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
