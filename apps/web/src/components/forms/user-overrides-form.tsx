'use client';

// Per-user permission OVERRIDES editor (D-17). Opened from the Users table. For
// each of the 10 permission atoms it shows the inherited base (granted by the
// user's role + groups) and a 3-state override control:
//   Inherit (default) → users.clearOverride
//   Force grant       → users.setOverride { granted: true }
//   Force revoke      → users.setOverride { granted: false }
// Each change invalidates users.byId (+ users.list) so the row reflects truth.
import { useState, type ReactNode } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@orqafy/ui';
import type { Permission } from '@orqafy/shared';
import { trpc } from '@/trpc/react';
import { permissionLabel } from './permission-labels';

type OverrideState = 'inherit' | 'grant' | 'revoke';

function isOverrideState(value: string): value is OverrideState {
  return value === 'inherit' || value === 'grant' || value === 'revoke';
}

export function UserOverridesDialog({
  userId,
  userName,
  trigger,
}: {
  userId: string;
  userName: string;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const atoms = trpc.roles.permissions.useQuery(undefined, { enabled: open });
  const detail = trpc.users.byId.useQuery({ id: userId }, { enabled: open });
  const setOverride = trpc.users.setOverride.useMutation();
  const clearOverride = trpc.users.clearOverride.useMutation();

  const user = detail.data ?? null;

  /** Whether a permission is granted by the user's role or any of their groups. */
  function inheritedBase(permission: string): boolean {
    if (user === null) return false;
    if (user.role.permissions.includes(permission as Permission)) return true;
    return user.groups.some((g) => g.permissions.includes(permission as Permission));
  }

  /** Current override state for a permission (inherit = no override row). */
  function overrideState(permission: string): OverrideState {
    const override = user?.overrides.find((o) => o.permission === permission);
    if (override === undefined) return 'inherit';
    return override.granted ? 'grant' : 'revoke';
  }

  async function onChange(permission: Permission, next: OverrideState) {
    if (next === 'inherit') {
      await clearOverride.mutateAsync({ userId, permission });
    } else {
      await setOverride.mutateAsync({ userId, permission, granted: next === 'grant' });
    }
    await Promise.all([utils.users.byId.invalidate({ id: userId }), utils.users.list.invalidate()]);
  }

  const busy = setOverride.isPending || clearOverride.isPending || detail.isFetching;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Permissions — {userName}</DialogTitle>
          <DialogDescription>
            Override individual permissions on top of this user’s role and groups. “Inherit” keeps
            the base grant.
          </DialogDescription>
        </DialogHeader>

        {detail.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : user === null ? (
          <p className="text-sm text-destructive">This user could not be loaded.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Permission</TableHead>
                <TableHead>From role / groups</TableHead>
                <TableHead className="w-44">Override</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {atoms.data?.map((p) => {
                const base = inheritedBase(p);
                return (
                  <TableRow key={p}>
                    <TableCell className="font-medium">{permissionLabel(p)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {base ? 'Granted' : 'Not granted'}
                    </TableCell>
                    <TableCell>
                      <Select
                        aria-label={`Override ${permissionLabel(p)}`}
                        value={overrideState(p)}
                        disabled={busy}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (isOverrideState(next)) void onChange(p, next);
                        }}
                      >
                        <option value="inherit">Inherit (default)</option>
                        <option value="grant">Force grant</option>
                        <option value="revoke">Force revoke</option>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <div className="flex justify-end">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
