// Dependency-free checkbox styled to the shadcn tokens (MIT, our own code). A
// native <input type="checkbox"> — the app layer binds it to react-hook-form via
// `register` (multiple same-name checkboxes collect their checked values into an
// array). We deliberately avoid pulling @radix-ui/react-checkbox into the public
// AGPL bundle for a simple boolean control (mirrors the Select decision).
import type { ComponentProps } from 'react';

import { cn } from '../../lib/utils';

export function Checkbox({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      data-slot="checkbox"
      className={cn(
        'size-4 shrink-0 rounded-sm border border-input bg-background align-middle accent-primary shadow-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
      type="checkbox"
    />
  );
}
