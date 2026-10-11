import { cn } from '@orqafy/ui';
import { OrcaMark } from '@/components/branding/orca-mark';

/**
 * Orqafy product wordmark (D-29, ORQ-37). The orca product mark (Concept A
 * — "Rising Diagonal Leap", self-contained badge, reads on light + dark) +
 * the "Orqafy" wordmark text. Used at the sidebar (app-shell.tsx) and the
 * login screen — never near the "Developed by Powerbyte IT Solutions"
 * footer credit, which stays text-only per D-29.
 *
 * Client-safe (no client hooks, no deps beyond `cn`/`OrcaMark`), so it
 * renders in Server and Client components alike. The wordmark text still
 * tracks the foreground theme token; the mark itself carries its own fixed
 * brand colors (a logo is not re-themed light/dark).
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
      <OrcaMark
        className={s.mark}
        // When the wordmark text is hidden, the mark carries the accessible name;
        // when it is shown, the text label is authoritative and the mark is decorative.
        aria-label={showWordmark ? undefined : 'Orqafy'}
        aria-hidden={showWordmark ? true : undefined}
      />
      {showWordmark ? (
        <span className={cn('font-sans font-semibold tracking-tight text-foreground', s.text)}>
          Orqafy
        </span>
      ) : null}
    </span>
  );
}
