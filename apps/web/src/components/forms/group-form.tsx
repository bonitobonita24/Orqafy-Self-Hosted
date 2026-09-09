'use client';

// Create / edit a permission GROUP (D-17 — the custom permission-group builder).
// Mirrors user-form.tsx: react-hook-form + zodResolver + @orqafy/ui primitives,
// wired to the `roles.create` / `roles.update` tRPC mutations. The permission
// checklist is sourced from `roles.permissions` (the 10 atoms) and rendered as a
// Checkbox grid with human labels.
//
// SYSTEM groups (isSystem) keep their identity: the name input is read-only and
// only the permission set is editable (the API also ignores a system group's
// name on update). Deleting a system group is blocked server-side; the roles page
// only offers delete for custom groups.
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Checkbox,
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
import type { Permission } from '@orqafy/shared';
import { trpc } from '@/trpc/react';
import { groupFormSchema, type GroupFormValues } from './schema';
import { permissionLabel } from './permission-labels';

interface GroupLike {
  id: string;
  name: string;
  permissions: Permission[];
  isSystem: boolean;
}

function toDefaults(group?: GroupLike): GroupFormValues {
  return {
    name: group?.name ?? '',
    permissions: group?.permissions ?? [],
  };
}

export function GroupFormDialog({ group, trigger }: { group?: GroupLike; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const isEdit = group !== undefined;
  const isSystem = group?.isSystem ?? false;
  const utils = trpc.useUtils();
  const permissions = trpc.roles.permissions.useQuery(undefined, { enabled: open });

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: toDefaults(group),
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  const create = trpc.roles.create.useMutation();
  const update = trpc.roles.update.useMutation();
  const mutationError = create.error ?? update.error;

  async function onSubmit(values: GroupFormValues) {
    // The checklist collects the canonical underscore atoms, so this narrows to
    // Permission[] (the tRPC mutation validates them against permissionEnum).
    const selected = values.permissions as Permission[];
    if (isEdit) {
      await update.mutateAsync({
        id: group.id,
        // System groups preserve their name server-side — don't send it.
        ...(isSystem ? {} : { name: values.name }),
        permissions: selected,
      });
    } else {
      await create.mutateAsync({ name: values.name, permissions: selected });
    }
    await utils.roles.list.invalidate();
    setOpen(false);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset(toDefaults(group));
    create.reset();
    update.reset();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit group' : 'New group'}</DialogTitle>
          <DialogDescription>
            {isSystem
              ? 'This is a system role — its name is fixed; adjust its permissions below.'
              : 'Name the group and choose the permissions it grants.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
          <FormItem>
            <FormLabel htmlFor="group-name">Name</FormLabel>
            <Input id="group-name" readOnly={isSystem} {...register('name')} />
            {errors.name ? <FormMessage>{errors.name.message}</FormMessage> : null}
          </FormItem>

          <FormItem>
            <FormLabel>Permissions</FormLabel>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {permissions.data?.map((p) => (
                <label
                  key={p}
                  htmlFor={`group-perm-${p}`}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox id={`group-perm-${p}`} value={p} {...register('permissions')} />
                  {permissionLabel(p)}
                </label>
              ))}
            </div>
            {errors.permissions ? <FormMessage>{errors.permissions.message}</FormMessage> : null}
          </FormItem>

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
              {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
