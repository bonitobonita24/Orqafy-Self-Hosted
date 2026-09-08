'use client';

// Create / edit a Milestone (PRODUCT Core Entities). Bound to `milestoneFormSchema`
// via react-hook-form + zodResolver, wired to the `milestones.create` /
// `milestones.update` tRPC mutations. `projectId` is fixed by the project detail
// page the dialog is opened from. Client sign-off is a v2 flow — not exposed here.
// Mobile Ready (DESIGN §6): single-column form, stacked label+input.
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
import { milestoneFormSchema, type MilestoneFormValues, MILESTONE_STATUS, toDate } from './schema';

interface MilestoneLike {
  id: string;
  title: string;
  status: string;
  targetDate: Date | null;
}

function dateInput(d: Date | null | undefined): string {
  return d ? new Date(d).toISOString().slice(0, 10) : '';
}

function toDefaults(milestone?: MilestoneLike): MilestoneFormValues {
  return {
    title: milestone?.title ?? '',
    status: (milestone?.status as MilestoneFormValues['status']) ?? 'pending',
    targetDate: dateInput(milestone?.targetDate),
  };
}

export function MilestoneFormDialog({
  projectId,
  milestone,
  trigger,
}: {
  projectId: string;
  milestone?: MilestoneLike;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = milestone !== undefined;
  const utils = trpc.useUtils();

  const form = useForm<MilestoneFormValues>({
    resolver: zodResolver(milestoneFormSchema),
    defaultValues: toDefaults(milestone),
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  const create = trpc.milestones.create.useMutation();
  const update = trpc.milestones.update.useMutation();
  const mutationError = create.error ?? update.error;

  async function onSubmit(values: MilestoneFormValues) {
    if (isEdit) {
      await update.mutateAsync({
        id: milestone.id,
        title: values.title,
        status: values.status,
        targetDate: toDate(values.targetDate),
      });
    } else {
      await create.mutateAsync({
        projectId,
        title: values.title,
        status: values.status,
        targetDate: toDate(values.targetDate),
      });
    }
    await utils.projects.byId.invalidate({ id: projectId });
    setOpen(false);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset(toDefaults(milestone));
    create.reset();
    update.reset();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit milestone' : 'New milestone'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update this milestone.' : 'Add a checkpoint to this project.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
          <FormItem>
            <FormLabel htmlFor="milestone-title">Title</FormLabel>
            <Input id="milestone-title" {...register('title')} />
            {errors.title ? <FormMessage>{errors.title.message}</FormMessage> : null}
          </FormItem>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormItem>
              <FormLabel htmlFor="milestone-status">Status</FormLabel>
              <Select id="milestone-status" {...register('status')}>
                {MILESTONE_STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </FormItem>
            <FormItem>
              <FormLabel htmlFor="milestone-target">Target date</FormLabel>
              <Input id="milestone-target" type="date" {...register('targetDate')} />
            </FormItem>
          </div>

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
              {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create milestone'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
