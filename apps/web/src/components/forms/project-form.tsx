'use client';

// Create / edit a Project (D-5). Bound to `projectFormSchema` (derived from
// @orqafy/shared `projectSchema`) via react-hook-form + zodResolver, wired to the
// existing `projects.create` / `projects.update` tRPC mutations. Mobile Ready.
// NOTE: `code` and `clientId` are immutable after creation — the API's
// `projects.update` input does not accept them — so they are shown read-only in
// edit mode and never sent.
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
  Textarea,
} from '@orqafy/ui';
import { trpc } from '@/trpc/react';
import {
  projectFormSchema,
  type ProjectFormValues,
  PROJECT_STATUS,
  blankToUndef,
  toDate,
} from './schema';

interface ProjectLike {
  id: string;
  name: string;
  code: string;
  clientId: string;
  status: string;
  description: string | null;
  startDate: Date | null;
  targetEndDate: Date | null;
}

function dateInput(d: Date | null | undefined): string {
  return d ? new Date(d).toISOString().slice(0, 10) : '';
}

function toDefaults(project?: ProjectLike, presetClientId?: string): ProjectFormValues {
  return {
    name: project?.name ?? '',
    code: project?.code ?? '',
    clientId: project?.clientId ?? presetClientId ?? '',
    status: (project?.status as ProjectFormValues['status']) ?? 'planning',
    description: project?.description ?? '',
    startDate: dateInput(project?.startDate),
    targetEndDate: dateInput(project?.targetEndDate),
  };
}

export function ProjectFormDialog({
  project,
  presetClientId,
  trigger,
}: {
  project?: ProjectLike;
  presetClientId?: string;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = project !== undefined;
  const utils = trpc.useUtils();
  const clients = trpc.clients.list.useQuery(undefined, { enabled: open });

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: toDefaults(project, presetClientId),
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  const create = trpc.projects.create.useMutation();
  const update = trpc.projects.update.useMutation();
  const mutationError = create.error ?? update.error;

  async function onSubmit(values: ProjectFormValues) {
    if (isEdit) {
      await update.mutateAsync({
        id: project.id,
        name: values.name,
        status: values.status,
        description: blankToUndef(values.description ?? undefined),
        startDate: toDate(values.startDate),
        targetEndDate: toDate(values.targetEndDate),
      });
    } else {
      await create.mutateAsync({
        name: values.name,
        code: values.code,
        clientId: values.clientId,
        status: values.status,
        description: blankToUndef(values.description ?? undefined),
        startDate: toDate(values.startDate),
        targetEndDate: toDate(values.targetEndDate),
      });
    }
    await Promise.all([utils.projects.list.invalidate(), utils.clients.list.invalidate()]);
    if (isEdit) await utils.projects.byId.invalidate({ id: project.id });
    setOpen(false);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset(toDefaults(project, presetClientId));
    create.reset();
    update.reset();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit project' : 'New project'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update this project’s details.' : 'Create a project under a client.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
          <FormItem>
            <FormLabel htmlFor="project-name">Name</FormLabel>
            <Input id="project-name" {...register('name')} />
            {errors.name ? <FormMessage>{errors.name.message}</FormMessage> : null}
          </FormItem>

          <FormItem>
            <FormLabel htmlFor="project-code">Code</FormLabel>
            <Input id="project-code" disabled={isEdit} {...register('code')} />
            {isEdit ? null : errors.code ? <FormMessage>{errors.code.message}</FormMessage> : null}
          </FormItem>

          <FormItem>
            <FormLabel htmlFor="project-client">Client</FormLabel>
            <Select id="project-client" disabled={isEdit} {...register('clientId')}>
              <option value="">Select a client…</option>
              {clients.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            {isEdit ? null : errors.clientId ? (
              <FormMessage>{errors.clientId.message}</FormMessage>
            ) : null}
          </FormItem>

          <FormItem>
            <FormLabel htmlFor="project-status">Status</FormLabel>
            <Select id="project-status" {...register('status')}>
              {PROJECT_STATUS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </FormItem>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormItem>
              <FormLabel htmlFor="project-start">Start date</FormLabel>
              <Input id="project-start" type="date" {...register('startDate')} />
            </FormItem>
            <FormItem>
              <FormLabel htmlFor="project-end">Target end date</FormLabel>
              <Input id="project-end" type="date" {...register('targetEndDate')} />
            </FormItem>
          </div>

          <FormItem>
            <FormLabel htmlFor="project-desc">Description</FormLabel>
            <Textarea id="project-desc" {...register('description')} />
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
              {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
