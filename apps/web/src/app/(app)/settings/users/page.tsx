'use client';

// Users & Roles admin (D-17). Requires `manage_users` — the API forbids the
// queries/mutations otherwise. This surface covers listing users and CREATING /
// EDITING a user with a ROLE ASSIGNMENT. The full permission-builder editor
// (custom groups + per-user overrides UI) is a SEPARATE later chunk; the role /
// permission data and mutations for it already exist on the API.
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Plus, Pencil, KeyRound, SlidersHorizontal, UserX } from 'lucide-react';
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
import { UserFormDialog } from '@/components/forms/user-form';
import { UserOverridesDialog } from '@/components/forms/user-overrides-form';
import { UserExportButton } from '@/components/forms/user-export-button';
import { UserEraseDialog } from '@/components/forms/user-erase-dialog';

export default function UsersRolesPage() {
  const { data: session } = useSession();
  const users = trpc.users.list.useQuery(undefined, { retry: false });
  const roles = trpc.roles.list.useQuery();

  const forbidden = users.error?.data?.code === 'FORBIDDEN';
  const currentUserId = session?.user.id;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Users &amp; Roles</h1>
        {forbidden ? null : (
          <UserFormDialog
            trigger={
              <Button>
                <Plus /> New user
              </Button>
            }
          />
        )}
      </div>

      {forbidden ? (
        <p className="text-sm text-destructive">You do not have permission to manage users.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.data?.map((u) => {
                  const isErased = u.anonymizedAt !== null;
                  const isSelf = u.id === currentUserId;
                  return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {u.name}
                        {isErased ? (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                            Erased
                          </span>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>{u.role.name}</TableCell>
                    <TableCell>{u.isActive ? 'Yes' : 'No'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <UserExportButton userId={u.id} userEmail={u.email} />
                        <UserOverridesDialog
                          userId={u.id}
                          userName={u.name}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Permissions for ${u.name}`}
                            >
                              <SlidersHorizontal />
                            </Button>
                          }
                        />
                        <UserFormDialog
                          user={{
                            id: u.id,
                            name: u.name,
                            email: u.email,
                            roleId: u.roleId,
                            phone: u.phone,
                            isActive: u.isActive,
                          }}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label={`Edit ${u.name}`}>
                              <Pencil />
                            </Button>
                          }
                        />
                        {!isSelf && !isErased ? (
                          <UserEraseDialog
                            userId={u.id}
                            userEmail={u.email}
                            userName={u.name}
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Erase ${u.name}`}
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              >
                                <UserX />
                              </Button>
                            }
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle>Roles &amp; permission groups</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/roles">
              <KeyRound /> Manage groups
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {roles.data?.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm">
              <span className="font-medium">{r.name}</span>
              <span className="text-muted-foreground">
                {r.isSystem ? 'system' : 'custom'} · {r.permissions.length} permissions
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
