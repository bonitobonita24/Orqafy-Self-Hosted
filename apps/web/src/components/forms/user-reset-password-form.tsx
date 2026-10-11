'use client';

// Admin "reset password" dialog (ORQ-55 W5). Opened from the Users table —
// the admin TYPES the new password directly (no email/token flow), mirroring
// `user-overrides-form.tsx`'s dialog shape. Wired to `trpc.users.resetPassword`
// (manage_users-gated server-side; this page already requires that permission).
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@orqafy/ui';
import { trpc } from '@/trpc/react';
import { resetPasswordFormSchema, type ResetPasswordFormValues } from './schema';

export function UserResetPasswordDialog({
  userId,
  userName,
  trigger,
}: {
  userId: string;
  userName: string;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const utils = trpc.useUtils();
  const resetPassword = trpc.users.resetPassword.useMutation();

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  async function onSubmit(values: ResetPasswordFormValues) {
    await resetPassword.mutateAsync({ userId, newPassword: values.newPassword });
    await utils.users.list.invalidate();
    setDone(true);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset({ newPassword: '', confirmPassword: '' });
      resetPassword.reset();
      setDone(false);
    }
  }

  const topLevelError =
    resetPassword.error !== null
      ? resetPassword.error.data?.code === 'TOO_MANY_REQUESTS'
        ? 'Too many attempts. Try again later.'
        : resetPassword.error.message || 'Something went wrong. Please try again.'
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password — {userName}</DialogTitle>
          <DialogDescription>
            Set a new password for this user. They will need to sign in with it next time.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <p role="status" aria-live="polite" className="text-sm text-foreground">
            Password reset.
          </p>
        ) : (
          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
            <FormItem>
              <FormLabel htmlFor="reset-new-password">New password</FormLabel>
              <Input
                id="reset-new-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={errors.newPassword !== undefined}
                {...register('newPassword')}
              />
              {errors.newPassword ? <FormMessage>{errors.newPassword.message}</FormMessage> : null}
            </FormItem>

            <FormItem>
              <FormLabel htmlFor="reset-confirm-password">Confirm new password</FormLabel>
              <Input
                id="reset-confirm-password"
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

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Resetting…' : 'Reset password'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
