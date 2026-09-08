// Form primitives (shadcn field structure, MIT). These are the RHF-agnostic
// STRUCTURAL wrappers (FormItem/FormLabel/FormControl/FormDescription/
// FormMessage). TODO(part-5): the app layer binds these to react-hook-form
// (FormField/Controller + aria wiring) — kept out of the shared package so the
// UI layer carries no form-state dependency.
import type { ComponentProps } from 'react';

import { cn } from '../../lib/utils';
import { Label } from './label';

export function FormItem({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="form-item" className={cn('space-y-2', className)} {...props} />;
}

export function FormLabel({ className, ...props }: ComponentProps<typeof Label>) {
  return <Label data-slot="form-label" className={className} {...props} />;
}

export function FormControl({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="form-control" className={className} {...props} />;
}

export function FormDescription({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      data-slot="form-description"
      className={cn('text-xs text-muted-foreground', className)}
      {...props}
    />
  );
}

export function FormMessage({ className, children, ...props }: ComponentProps<'p'>) {
  return (
    <p
      data-slot="form-message"
      className={cn('text-xs font-medium text-destructive', className)}
      {...props}
    >
      {children}
    </p>
  );
}
