import { cn } from '@orqafy/ui';

/**
 * Orqafy product wordmark (D-29). A cohesive typographic placeholder:
 * a rounded-square "O" monogram in the brand color + the "Orqafy" wordmark.
 *
 * This is a deliberate TEXT placeholder — swap the monogram/wordmark for a
 * finished logo asset later without touching the call sites. Client-safe (no
 * client hooks, no deps beyond `cn`), so it renders in Server and Client
 * components alike. All color comes from theme tokens (primary /
 * primary-foreground / foreground) — never a hardcoded hex — so it tracks the
 * light/dark palette in @orqafy/ui.
 */
type WordmarkSize = 'sm' | 'md' | 'lg';

const SIZES: Record<WordmarkSize, { root: string; mark: string; text: string }> = {
  sm: { root: 'gap-1.5', mark: 'size-5', text: 'text-base' },
  md: { root: 'gap-2', mark: 'size-7', text: 'text-lg' },
  lg: { root: 'gap-2.5', mark: 'size-10', text: 'text-2xl' },
};

export interface OrqafyWordmarkProps {
  /** Visual scale. Defaults to `md`. */
  size?: WordmarkSize;
  /** When false, render the "O" monogram only (e.g. a collapsed rail). Defaults to true. */
  showWordmark?: boolean;
  className?: string;
}

export function OrqafyWordmark({
  size = 'md',
  showWordmark = true,
  className,
}: OrqafyWordmarkProps) {
  const s = SIZES[size];
  return (
    <span className={cn('inline-flex items-center', s.root, className)}>
      <svg
        viewBox="0 0 32 32"
        className={cn('shrink-0', s.mark)}
        role="img"
        // When the wordmark text is hidden, the mark carries the accessible name;
        // when it is shown, the text label is authoritative and the mark is decorative.
        aria-label={showWordmark ? undefined : 'Orqafy'}
        aria-hidden={showWordmark ? true : undefined}
      >
        <rect width="32" height="32" rx="8" className="fill-primary" />
        <circle
          cx="16"
          cy="16"
          r="7"
          fill="none"
          strokeWidth={3.4}
          className="stroke-primary-foreground"
        />
      </svg>
      {showWordmark ? (
        <span className={cn('font-sans font-semibold tracking-tight text-foreground', s.text)}>
          Orqafy
        </span>
      ) : null}
    </span>
  );
}
