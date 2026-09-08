'use client';

// Create / edit a Client (D-5). Bound to `clientFormSchema` (derived from
// @orqafy/shared `clientSchema`) via react-hook-form + zodResolver, wired to the
// existing `clients.create` / `clients.update` tRPC mutations. Mobile Ready
// (DESIGN §6): single-column form, max-w, stacked label+input.
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
  Textarea,
} from '@orqafy/ui';
import { trpc } from '@/trpc/react';
import { clientFormSchema, type ClientFormValues, blankToUndef } from './schema';

interface ClientLike {
  id: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
}

function toDefaults(client?: ClientLike): ClientFormValues {
  return {
    name: client?.name ?? '',
    contactPerson: client?.contactPerson ?? '',
    email: client?.email ?? '',
    phone: client?.phone ?? '',
    address: client?.address ?? '',
    notes: client?.notes ?? '',
  };
}

export function ClientFormDialog({ client, trigger }: { client?: ClientLike; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const isEdit = client !== undefined;
  const utils = trpc.useUtils();

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: toDefaults(client),
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  const create = trpc.clients.create.useMutation();
  const update = trpc.clients.update.useMutation();
  const mutationError = create.error ?? update.error;

  async function onSubmit(values: ClientFormValues) {
    const payload = {
      name: values.name,
      contactPerson: blankToUndef(values.contactPerson ?? undefined),
      email: blankToUndef(values.email ?? undefined),
      phone: blankToUndef(values.phone ?? undefined),
      address: blankToUndef(values.address ?? undefined),
      notes: blankToUndef(values.notes ?? undefined),
    };
    if (isEdit) {
      await update.mutateAsync({ id: client.id, ...payload });
    } else {
      await create.mutateAsync(payload);
    }
    await utils.clients.list.invalidate();
    setOpen(false);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset(toDefaults(client));
    create.reset();
    update.reset();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit client' : 'New client'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update this client’s details.' : 'Add a client to run projects for.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
          <FormItem>
            <FormLabel htmlFor="client-name">Name</FormLabel>
            <Input id="client-name" {...register('name')} />
            {errors.name ? <FormMessage>{errors.name.message}</FormMessage> : null}
          </FormItem>

          <FormItem>
            <FormLabel htmlFor="client-contact">Contact person</FormLabel>
            <Input id="client-contact" {...register('contactPerson')} />
          </FormItem>

          <FormItem>
            <FormLabel htmlFor="client-email">Email</FormLabel>
            <Input id="client-email" type="email" {...register('email')} />
            {errors.email ? <FormMessage>{errors.email.message}</FormMessage> : null}
          </FormItem>

          <FormItem>
            <FormLabel htmlFor="client-phone">Phone</FormLabel>
            <Input id="client-phone" {...register('phone')} />
          </FormItem>

          <FormItem>
            <FormLabel htmlFor="client-address">Address</FormLabel>
            <Input id="client-address" {...register('address')} />
          </FormItem>

          <FormItem>
            <FormLabel htmlFor="client-notes">Notes</FormLabel>
            <Textarea id="client-notes" {...register('notes')} />
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
              {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
