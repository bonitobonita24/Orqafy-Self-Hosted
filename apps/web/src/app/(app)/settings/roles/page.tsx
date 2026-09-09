'use client';

// Permission-group builder (D-17). Lists system roles + custom groups and lets a
// `manage_users` operator create / edit / delete CUSTOM groups (system groups are
// edit-only — their permission set is adjustable, their identity is fixed). The
// guard mirrors the users page: `users.list` is `manage_users`-gated, so a
// FORBIDDEN there hides the mutating affordances while the read-only list stays.
import Link from 'next/link';
import { Plus, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@orqafy/ui';
import { trpc } from '@/trpc/react';
import { GroupFormDialog } from '@/components/forms/group-form';

function DeleteGroupButton({ id, name }: { id: string; name: string }) {
  const utils = trpc.useUtils();
  const del = trpc.roles.delete.useMutation();

  async function onDelete() {
    if (!window.confirm(`Delete the “${name}” group? This cannot be undone.`)) return;
    await del.mutateAsync({ id });
    await utils.roles.list.invalidate();
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Delete ${name}`}
      disabled={del.isPending}
      onClick={() => void onDelete()}
    >
      <Trash2 />
    </Button>
  );
}

export default function RolesPage() {
  // Probe for `manage_users` the same way the users page does.
  const permissionProbe = trpc.users.list.useQuery(undefined, { retry: false });
  const groups = trpc.roles.list.useQuery();

  const forbidden = permissionProbe.error?.data?.code === 'FORBIDDEN';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Permission groups</h1>
          <Link
            href="/settings/users"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back to Users &amp; Roles
          </Link>
        </div>
        {forbidden ? null : (
          <GroupFormDialog
            trigger={
              <Button>
                <Plus /> New group
              </Button>
            }
          />
        )}
      </div>

      {forbidden ? (
        <p className="text-sm text-destructive">
          You do not have permission to manage permission groups.
        </p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Groups</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.data?.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell>
                      <span
                        className={
                          g.isSystem
                            ? 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
                            : 'inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary'
                        }
                      >
                        {g.isSystem ? 'system' : 'custom'}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{g.permissions.length}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <GroupFormDialog
                          group={{
                            id: g.id,
                            name: g.name,
                            permissions: g.permissions,
                            isSystem: g.isSystem,
                          }}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label={`Edit ${g.name}`}>
                              <Pencil />
                            </Button>
                          }
                        />
                        {g.isSystem ? null : <DeleteGroupButton id={g.id} name={g.name} />}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
