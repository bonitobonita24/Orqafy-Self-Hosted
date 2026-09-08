'use client';

// Apply-for-leave form (D-21). Bound to `leaveFormSchema` via react-hook-form +
// zodResolver, wired to the `leave.submitRequest` tRPC mutation. Leave only — no
// attendance/payroll. `reason` is OPTIONAL and must never require health detail
// (SPI minimisation, PH DPA). Mobile First (DESIGN §6): stacked, single-column.
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  FormItem,
  FormLabel,
  FormDescription,
  FormMessage,
  Input,
  Select,
  Textarea,
} from '@orqafy/ui';
import { trpc } from '@/trpc/react';
import { leaveFormSchema, type LeaveFormValues, blankToUndef, toDate } from './schema';

export function LeaveApplyForm() {
  const utils = trpc.useUtils();
  const types = trpc.leave.types.useQuery();

  const form = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveFormSchema),
    defaultValues: { leaveTypeId: '', startDate: '', endDate: '', reason: '' },
  });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  const apply = trpc.leave.submitRequest.useMutation();

  async function onSubmit(values: LeaveFormValues) {
    const start = toDate(values.startDate);
    const end = toDate(values.endDate);
    if (start === undefined || end === undefined) return;
    if (end < start) {
      setError('endDate', { message: 'End date is before the start date' });
      return;
    }
    await apply.mutateAsync({
      leaveTypeId: values.leaveTypeId,
      startDate: start,
      endDate: end,
      reason: blankToUndef(values.reason ?? undefined),
    });
    await utils.leave.myRequests.invalidate();
    reset({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormItem>
          <FormLabel htmlFor="leave-type">Type</FormLabel>
          <Select id="leave-type" {...register('leaveTypeId')}>
            <option value="">Select…</option>
            {types.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          {errors.leaveTypeId ? <FormMessage>{errors.leaveTypeId.message}</FormMessage> : null}
        </FormItem>
        <FormItem>
          <FormLabel htmlFor="leave-start">Start</FormLabel>
          <Input id="leave-start" type="date" {...register('startDate')} />
          {errors.startDate ? <FormMessage>{errors.startDate.message}</FormMessage> : null}
        </FormItem>
        <FormItem>
          <FormLabel htmlFor="leave-end">End</FormLabel>
          <Input id="leave-end" type="date" {...register('endDate')} />
          {errors.endDate ? <FormMessage>{errors.endDate.message}</FormMessage> : null}
        </FormItem>
      </div>

      <FormItem>
        <FormLabel htmlFor="leave-reason">Reason (optional)</FormLabel>
        <Textarea id="leave-reason" {...register('reason')} />
        <FormDescription>
          Optional. Do not include health or other sensitive personal details.
        </FormDescription>
      </FormItem>

      {apply.error ? (
        <p className="text-sm text-destructive">
          {apply.error.message || 'Something went wrong. Please try again.'}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Submitting…' : 'Submit request'}
      </Button>
    </form>
  );
}
