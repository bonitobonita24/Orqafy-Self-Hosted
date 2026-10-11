'use client';

// Settings → Account (ORQ-55 W4). Self-service password change, available to
// EVERY signed-in user (no permission gate — a user always owns their own
// credentials). Wired to `trpc.auth.changePassword`.
//
// Changing the password invalidates the caller's OWN session: web cookie
// sessions carry `authTime`, checked against `passwordChangedAt` on every
// request (L-2 web). So on success we show a brief confirmation, then sign
// the user out and send them to /login to re-authenticate — staying on this
// page would just 401 on the next tRPC call.
import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@orqafy/ui';
import { trpc } from '@/trpc/react';
import { changePasswordFormSchema, type ChangePasswordFormValues } from '@/components/forms/schema';

const SIGN_OUT_DELAY_MS = 1500;

export default function AccountSettingsPage() {
  const [signingOut, setSigningOut] = useState(false);
  const changePassword = trpc.auth.changePassword.useMutation();

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  async function onSubmit(values: ChangePasswordFormValues) {
    try {
      await changePassword.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
    } catch (err) {
      const code = (err as { data?: { code?: string } } | undefined)?.data?.code;
      if (code === 'UNAUTHORIZED') {
        setError('currentPassword', { message: 'Current password is incorrect.' });
      } else if (code === 'TOO_MANY_REQUESTS') {
        setError('currentPassword', { message: 'Too many attempts. Try again later.' });
      }
      return;
    }

    setSigningOut(true);
    setTimeout(() => {
      void signOut({ callbackUrl: '/login' });
    }, SIGN_OUT_DELAY_MS);
  }

  const topLevelError =
    changePassword.error !== null &&
    changePassword.error.data?.code !== 'UNAUTHORIZED' &&
    changePassword.error.data?.code !== 'TOO_MANY_REQUESTS'
      ? changePassword.error.message || 'Something went wrong. Please try again.'
      : null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-muted-foreground">Change your sign-in password.</p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            You will be signed out after changing your password and need to sign back in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {signingOut ? (
            <p role="status" aria-live="polite" className="text-sm text-foreground">
              Password changed. Signing you out…
            </p>
          ) : (
            <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
              <FormItem>
                <FormLabel htmlFor="account-current-password">Current password</FormLabel>
                <Input
                  id="account-current-password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={errors.currentPassword !== undefined}
                  {...register('currentPassword')}
                />
                {errors.currentPassword ? (
                  <FormMessage>{errors.currentPassword.message}</FormMessage>
                ) : null}
              </FormItem>

              <FormItem>
                <FormLabel htmlFor="account-new-password">New password</FormLabel>
                <Input
                  id="account-new-password"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={errors.newPassword !== undefined}
                  {...register('newPassword')}
                />
                {errors.newPassword ? <FormMessage>{errors.newPassword.message}</FormMessage> : null}
              </FormItem>

              <FormItem>
                <FormLabel htmlFor="account-confirm-password">Confirm new password</FormLabel>
                <Input
                  id="account-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={errors.confirmPassword !== undefined}
                  {...register('confirmPassword')}
                />
                {errors.confirmPassword ? (
                  <FormMessage>{errors.confirmPassword.message}</FormMessage>
                ) : null}
              </FormItem>

              {topLevelError !== null ? (
                <p role="alert" className="text-sm text-destructive">
                  {topLevelError}
                </p>
              ) : null}

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Changing…' : 'Change password'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
