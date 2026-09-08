'use client';

// Create / edit a User (D-17). Bound to `userFormSchema` via react-hook-form +
// zodResolver, wired to the `users.create` / `users.update` tRPC mutations. This
// chunk covers ROLE ASSIGNMENT only — a user is given exactly one role (a system
// PermissionGroup). The full per-permission builder editor (custom groups +
// per-user overrides UI) is a SEPARATE later chunk; the API for it already exists.
//
// NOTE: `email` + `password` are create-only — `users.update` accepts neither, so
// in edit mode email is shown read-only and the password field is not rendered.
// Password is required on create (min 8), enforced here so edit can omit it.
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
  Select,
} from '@orqafy/ui';
import { trpc } from '@/trpc/react';
import { userFormSchema, type UserFormValues, blankToUndef } from './schema';

interface UserLike {
  id: string;
  name: string;
  email: string;
  roleId: string;
  phone: string | null;
  isActive: boolean;
}

function toDefaults(user?: UserLike): UserFormValues {
  return {
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
    roleId: user?.roleId ?? '',
    phone: user?.phone ?? '',
    isActive: user ? (user.isActive ? 'true' : 'false') : 'true',
  };
}

export function UserFormDialog({ user, trigger }: { user?: UserLike; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const isEdit = user !== undefined;
  const utils = trpc.useUtils();
  const roles = trpc.roles.list.useQuery(undefined, { enabled: open });

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: toDefaults(user),
  });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  const create = trpc.users.create.useMutation();
  const update = trpc.users.update.useMutation();
  const mutationError = create.error ?? update.error;

  async function onSubmit(values: UserFormValues) {
    if (isEdit) {
      await update.mutateAsync({
        id: user.id,
        name: values.name,
        roleId: values.roleId,
        phone: blankToUndef(values.phone ?? undefined),
        isActive: values.isActive === 'true',
      });
    } else {
      const password = values.password ?? '';
      if (password.length < 8) {
        setError('password', { message: 'Password must be at least 8 characters' });
        return;
      }
      await create.mutateAsync({
        name: values.name,
        email: values.email,
        password,
        roleId: values.roleId,
        phone: blankToUndef(values.phone ?? undefined),
      });
    }
    await utils.users.list.invalidate();
    setOpen(false);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset(toDefaults(user));
    create.reset();
    update.reset();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit user' : 'New user'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this user’s details and assigned role.'
              : 'Add a staff account and assign a role.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
          <FormItem>
            <FormLabel htmlFor="user-name">Name</FormLabel>
            <Input id="user-name" {...register('name')} />
            {errors.name ? <FormMessage>{errors.name.message}</FormMessage> : null}
          </FormItem>

          <FormItem>
            <FormLabel htmlFor="user-email">Email</FormLabel>
            <Input id="user-email" type="email" readOnly={isEdit} {...register('email')} />
            {errors.email ? <FormMessage>{errors.email.message}</FormMessage> : null}
          </FormItem>

          {isEdit ? null : (
            <FormItem>
              <FormLabel htmlFor="user-password">Password</FormLabel>
              <Input id="user-password" type="password" {...register('password')} />
              {errors.password ? <FormMessage>{errors.password.message}</FormMessage> : null}
            </FormItem>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormItem>
              <FormLabel htmlFor="user-role">Role</FormLabel>
              <Select id="user-role" disabled={roles.isLoading} {...register('roleId')}>
                <option value="">Select…</option>
                {roles.data?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.isSystem ? '' : ' (custom)'}
                  </option>
                ))}
              </Select>
              {errors.roleId ? <FormMessage>{errors.roleId.message}</FormMessage> : null}
            </FormItem>
            <FormItem>
              <FormLabel htmlFor="user-phone">Phone</FormLabel>
              <Input id="user-phone" {...register('phone')} />
            </FormItem>
          </div>

          {isEdit ? (
            <FormItem>
              <FormLabel htmlFor="user-active">Status</FormLabel>
              <Select id="user-active" {...register('isActive')}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Select>
            </FormItem>
          ) : null}

          {mutationError ? (
            <p className="text-sm text-destructive">
              {mutationError.message || 'Something went wrong. Please try again.'}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create user'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
