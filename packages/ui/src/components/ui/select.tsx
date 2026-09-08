// Native <select> styled to the shadcn tokens (MIT, our own code). A
// dependency-free enum picker — the app layer binds it to react-hook-form via
// `register`. We deliberately avoid pulling @radix-ui/react-select into the
// public AGPL bundle for what are simple single-value pickers.
import type { ComponentProps } from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '../../lib/utils';

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          'flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 pr-8 text-sm shadow-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
