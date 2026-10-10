'use client';

// Admin right-to-erasure action (DPA W8, Rule 33 / `.ai_prompt/privacy.md`
// dsr.erase), rendered from the Users table. The server (`users.erase`) is
// the sole authority on the last-administrator / already-erased / self
// guards — this dialog only surfaces whatever it returns. The destructive
// action stays disabled until the admin types the target's email exactly
// (`canConfirmErase`), and `AlertDialogAction`'s default auto-close is
// prevented so a server rejection keeps the dialog open with the error
// shown inline (there is no toast system in this app).
import { useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  FormItem,
  FormLabel,
  Input,
} from '@orqafy/ui';
import { trpc } from '@/trpc/react';
import { canConfirmErase } from '@/lib/erase-confirm';

export function UserEraseDialog({
  userId,
  userEmail,
  userName,
  trigger,
}: {
  userId: string;
  userEmail: string;
  userName: string;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [typedEmail, setTypedEmail] = useState('');
  const utils = trpc.useUtils();
  const erase = trpc.users.erase.useMutation();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setTypedEmail('');
      erase.reset();
    }
  }

  async function handleErase() {
    try {
      await erase.mutateAsync({ userId, confirm: true });
    } catch {
      // Surfaced inline below via `erase.error` — dialog stays open.
      return;
    }
    await utils.users.list.invalidate();
    onOpenChange(false);
  }

  const canConfirm = canConfirmErase(typedEmail, userEmail);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Erase {userName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This is irreversible. Their name, email, and phone are replaced and the account is
            deactivated immediately — every sign-in is revoked. Tasks, documents, and audit
            history they created are kept as business records.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <FormItem>
          <FormLabel htmlFor="erase-confirm-email">
            Type <span className="font-mono">{userEmail}</span> to confirm
          </FormLabel>
          <Input
            id="erase-confirm-email"
            autoComplete="off"
            spellCheck={false}
            value={typedEmail}
            onChange={(e) => setTypedEmail(e.target.value)}
          />
        </FormItem>

        {erase.error ? (
          <p className="text-sm text-destructive">
            {erase.error.message || 'Something went wrong. Please try again.'}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={!canConfirm || erase.isPending}
            onClick={(e) => {
              e.preventDefault();
              void handleErase();
            }}
          >
            {erase.isPending ? 'Erasing…' : 'Erase user'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
