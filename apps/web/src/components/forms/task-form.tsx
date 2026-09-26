'use client';

// Create / edit a Task (D-19). Bound to `taskFormSchema` (derived from
// @orqafy/shared `taskSchema`) via react-hook-form + zodResolver, wired to the
// existing `tasks.create` / `tasks.update` tRPC mutations. `projectId` is fixed
// by the board the dialog is opened from.
//
// Geofence (D-19): the optional site-task anchor. All three coordinates
// (lat/lng/radius) are required together — validated here before submit. Presence
// is evaluated ON-DEVICE by the mobile app; NO location history is stored.
//
// NOTE: `tasks.update` does not accept `status` (status moves via the board's
// `tasks.move`), so the status field is create-only.
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
  FormDescription,
  FormMessage,
  Input,
  Select,
  Textarea,
} from '@orqafy/ui';
import { parseGeofenceStrings } from '@orqafy/shared';
import { trpc } from '@/trpc/react';
import { TaskPhotoStrip } from '@/components/tasks/task-photo-strip';
import { MapPicker } from './map-picker.client';
import {
  taskFormSchema,
  type TaskFormValues,
  TASK_STATUS,
  TASK_PRIORITY,
  blankToUndef,
  toDate,
} from './schema';

/** Stringify a map-derived coordinate to ~6 decimals (≈0.1 m) without trailing zeros. */
function coord(n: number): string {
  return String(Number(n.toFixed(6)));
}

interface TaskLike {
  id: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  location: { lat: number; lng: number; radiusMeters: number } | null;
  geofenceActiveFrom: Date | null;
  geofenceActiveUntil: Date | null;
}

function dateInput(d: Date | null | undefined): string {
  return d ? new Date(d).toISOString().slice(0, 10) : '';
}
function dateTimeInput(d: Date | null | undefined): string {
  return d ? new Date(d).toISOString().slice(0, 16) : '';
}

function toDefaults(task?: TaskLike): TaskFormValues {
  return {
    title: task?.title ?? '',
    description: task?.description ?? '',
    assigneeId: task?.assigneeId ?? '',
    status: (task?.status as TaskFormValues['status']) ?? 'todo',
    priority: (task?.priority as TaskFormValues['priority']) ?? 'medium',
    dueDate: dateInput(task?.dueDate),
    geofenceLat: task?.location ? String(task.location.lat) : '',
    geofenceLng: task?.location ? String(task.location.lng) : '',
    geofenceRadius: task?.location ? String(task.location.radiusMeters) : '',
    geofenceActiveFrom: dateTimeInput(task?.geofenceActiveFrom),
    geofenceActiveUntil: dateTimeInput(task?.geofenceActiveUntil),
  };
}

export function TaskFormDialog({
  projectId,
  task,
  trigger,
}: {
  projectId: string;
  task?: TaskLike;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = task !== undefined;
  const utils = trpc.useUtils();
  // Assignee list requires `manage_users`; degrade gracefully if unavailable.
  const users = trpc.users.list.useQuery(undefined, { enabled: open, retry: false });

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: toDefaults(task),
  });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  // Live numeric view of the geofence string inputs, feeding the map picker.
  const geo = parseGeofenceStrings({
    lat: watch('geofenceLat'),
    lng: watch('geofenceLng'),
    radius: watch('geofenceRadius'),
  });

  const create = trpc.tasks.create.useMutation();
  const update = trpc.tasks.update.useMutation();
  const mutationError = create.error ?? update.error;

  /** Resolve the optional geofence anchor; returns null when the group is empty
   *  and throws (via setError) when it is partially filled. */
  function resolveLocation(
    values: TaskFormValues,
  ): { lat: number; lng: number; radiusMeters: number } | null | 'invalid' {
    const latRaw = blankToUndef(values.geofenceLat ?? undefined);
    const lngRaw = blankToUndef(values.geofenceLng ?? undefined);
    const radiusRaw = blankToUndef(values.geofenceRadius ?? undefined);

    if (latRaw === undefined && lngRaw === undefined && radiusRaw === undefined) return null;

    // Partially filled → all three are required together.
    let missing = false;
    if (latRaw === undefined) {
      setError('geofenceLat', { message: 'Required with a geofence' });
      missing = true;
    }
    if (lngRaw === undefined) {
      setError('geofenceLng', { message: 'Required with a geofence' });
      missing = true;
    }
    if (radiusRaw === undefined) {
      setError('geofenceRadius', { message: 'Required with a geofence' });
      missing = true;
    }
    if (missing) return 'invalid';

    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    const radius = Number(radiusRaw);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      setError('geofenceLat', { message: 'Latitude must be a number between -90 and 90' });
      return 'invalid';
    }
    if (Number.isNaN(lng) || lng < -180 || lng > 180) {
      setError('geofenceLng', { message: 'Longitude must be a number between -180 and 180' });
      return 'invalid';
    }
    if (Number.isNaN(radius) || radius <= 0) {
      setError('geofenceRadius', { message: 'Radius must be a number greater than 0' });
      return 'invalid';
    }
    return { lat, lng, radiusMeters: radius };
  }

  async function onSubmit(values: TaskFormValues) {
    const location = resolveLocation(values);
    if (location === 'invalid') return;

    const shared = {
      description: blankToUndef(values.description ?? undefined),
      assigneeId: blankToUndef(values.assigneeId ?? undefined),
      priority: values.priority,
      dueDate: toDate(values.dueDate),
      geofenceActiveFrom: toDate(values.geofenceActiveFrom),
      geofenceActiveUntil: toDate(values.geofenceActiveUntil),
      ...(location !== null ? { location } : {}),
    };

    if (isEdit) {
      await update.mutateAsync({ id: task.id, title: values.title, ...shared });
    } else {
      await create.mutateAsync({
        projectId,
        title: values.title,
        status: values.status,
        ...shared,
      });
    }
    await utils.projects.byId.invalidate({ id: projectId });
    setOpen(false);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset(toDefaults(task));
    create.reset();
    update.reset();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit task' : 'New task'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update this task.' : 'Add a task to this project board.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
          <FormItem>
            <FormLabel htmlFor="task-title">Title</FormLabel>
            <Input id="task-title" {...register('title')} />
            {errors.title ? <FormMessage>{errors.title.message}</FormMessage> : null}
          </FormItem>

          <FormItem>
            <FormLabel htmlFor="task-desc">Description</FormLabel>
            <Textarea id="task-desc" {...register('description')} />
          </FormItem>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {isEdit ? null : (
              <FormItem>
                <FormLabel htmlFor="task-status">Status</FormLabel>
                <Select id="task-status" {...register('status')}>
                  {TASK_STATUS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </FormItem>
            )}
            <FormItem>
              <FormLabel htmlFor="task-priority">Priority</FormLabel>
              <Select id="task-priority" {...register('priority')}>
                {TASK_PRIORITY.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </FormItem>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormItem>
              <FormLabel htmlFor="task-assignee">Assignee</FormLabel>
              <Select id="task-assignee" disabled={users.isError} {...register('assigneeId')}>
                <option value="">Unassigned</option>
                {users.data?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
              {users.isError ? (
                <FormDescription>
                  Assignee list needs the user-management permission.
                </FormDescription>
              ) : null}
            </FormItem>
            <FormItem>
              <FormLabel htmlFor="task-due">Due date</FormLabel>
              <Input id="task-due" type="date" {...register('dueDate')} />
            </FormItem>
          </div>

          <div className="space-y-4 rounded-md border border-accent/30 bg-accent/5 p-4">
            <div>
              <p className="text-sm font-medium">Site geofence (optional)</p>
              <p className="text-xs text-muted-foreground">
                Turns this into a site task — the assignee is reminded on-device when they arrive.
                All three coordinates are required together.
              </p>
            </div>
            <div className="space-y-1">
              <MapPicker
                lat={geo.lat}
                lng={geo.lng}
                radiusMeters={geo.radiusMeters}
                onChange={({ lat, lng }) => {
                  setValue('geofenceLat', coord(lat), { shouldValidate: true });
                  setValue('geofenceLng', coord(lng), { shouldValidate: true });
                }}
              />
              <p className="text-xs text-muted-foreground">
                Click the map or drag the pin to set the anchor; type below for precise values. Set a
                radius to preview the geofence circle.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormItem>
                <FormLabel htmlFor="task-lat">Latitude</FormLabel>
                <Input id="task-lat" type="number" step="any" {...register('geofenceLat')} />
                {errors.geofenceLat ? (
                  <FormMessage>{errors.geofenceLat.message}</FormMessage>
                ) : null}
              </FormItem>
              <FormItem>
                <FormLabel htmlFor="task-lng">Longitude</FormLabel>
                <Input id="task-lng" type="number" step="any" {...register('geofenceLng')} />
                {errors.geofenceLng ? (
                  <FormMessage>{errors.geofenceLng.message}</FormMessage>
                ) : null}
              </FormItem>
              <FormItem>
                <FormLabel htmlFor="task-radius">Radius (m)</FormLabel>
                <Input id="task-radius" type="number" step="any" {...register('geofenceRadius')} />
                {errors.geofenceRadius ? (
                  <FormMessage>{errors.geofenceRadius.message}</FormMessage>
                ) : null}
              </FormItem>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormItem>
                <FormLabel htmlFor="task-gf-from">Active from</FormLabel>
                <Input
                  id="task-gf-from"
                  type="datetime-local"
                  {...register('geofenceActiveFrom')}
                />
              </FormItem>
              <FormItem>
                <FormLabel htmlFor="task-gf-until">Active until</FormLabel>
                <Input
                  id="task-gf-until"
                  type="datetime-local"
                  {...register('geofenceActiveUntil')}
                />
              </FormItem>
            </div>
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
              {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create task'}
            </Button>
          </DialogFooter>
        </form>

        {task !== undefined ? (
          <div className="mt-2 space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Site photos</p>
            <TaskPhotoStrip taskId={task.id} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
