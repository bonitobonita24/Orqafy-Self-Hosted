'use client';

// D-5 interactive first-run: the operator creates their OWN owner/admin account.
// No Powerbyte/universal credentials are ever pre-seeded.
import { useState, type FormEvent } from 'react';
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
import { trpc } from '@/trpc/react';

export default function SetupPage() {
  const router = useRouter();
  const status = trpc.setup.status.useQuery();
  const createAdmin = trpc.setup.createFirstAdmin.useMutation();

  const [orgName, setOrgName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    try {
      await createAdmin.mutateAsync({ orgName, adminName, email, password, setupToken });
      await signIn('credentials', { email, password, redirect: false });
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Could not complete setup. It may already be done — try signing in.');
    }
  }

  if (status.data?.needsSetup === false) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Already set up</CardTitle>
            <CardDescription>This install already has an admin account.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => router.push('/login')}>
              Go to sign in
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to Orqafy</CardTitle>
          <CardDescription>
            Set up your organisation and create your administrator account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organisation name</Label>
              <Input
                id="orgName"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminName">Your name</Label>
              <Input
                id="adminName"
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
              />
            </div>
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
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="setupToken">Setup token</Label>
              <Input
                id="setupToken"
                type="password"
                autoComplete="off"
                required
                value={setupToken}
                onChange={(e) => setSetupToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The SETUP_TOKEN value configured on the server for this install.
              </p>
            </div>
            {error !== null ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={createAdmin.isPending}>
              {createAdmin.isPending ? 'Setting up…' : 'Create admin & continue'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
