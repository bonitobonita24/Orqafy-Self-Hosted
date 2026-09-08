'use client';

// Users & Roles admin (D-17). Requires `manage_users` — the API forbids the
// queries/mutations otherwise. This surface covers listing users and CREATING /
// EDITING a user with a ROLE ASSIGNMENT. The full permission-builder editor
// (custom groups + per-user overrides UI) is a SEPARATE later chunk; the role /
// permission data and mutations for it already exist on the API.
import { Plus, Pencil } from 'lucide-react';
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

export default function UsersRolesPage() {
  const users = trpc.users.list.useQuery(undefined, { retry: false });
  const roles = trpc.roles.list.useQuery();

  const forbidden = users.error?.data?.code === 'FORBIDDEN';

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
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.data?.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>{u.role.name}</TableCell>
                    <TableCell>{u.isActive ? 'Yes' : 'No'}</TableCell>
                    <TableCell className="text-right">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Roles &amp; permission groups</CardTitle>
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
