// Design tokens — the typed mirror of docs/DESIGN.md §2–§3 (D-23).
//
// Neutral slate base + a single blueprint-blue primary (engineering/trust) +
// amber reserved narrowly for the location/geofence accent. Values are HSL
// triples ("H S% L%") so they drop straight into shadcn's CSS-variable model
// (`hsl(var(--primary))`). `globals.css` is the runtime source of truth for the
// cascade; this module is the programmatic mirror + a generator for tooling.

export interface ColorTokens {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  primary: string;
  primaryForeground: string;
  /** Geofence amber — the one assertive accent (DESIGN §5). */
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  success: string;
  warning: string;
  ring: string;
}

/** Light theme (DESIGN §2). */
export const lightColors: ColorTokens = {
  background: '222 20% 99%',
  foreground: '222 47% 11%',
  card: '0 0% 100%',
  cardForeground: '222 47% 11%',
  muted: '215 28% 95%',
  mutedForeground: '215 16% 42%',
  border: '215 20% 88%',
  input: '215 20% 88%',
  primary: '215 70% 42%',
  primaryForeground: '210 40% 98%',
  accent: '38 92% 50%',
  accentForeground: '222 47% 11%',
  destructive: '0 72% 51%',
  destructiveForeground: '0 0% 100%',
  success: '142 60% 38%',
  warning: '38 92% 50%',
  ring: '215 70% 42%',
};

/** Dark theme (DESIGN §2). */
export const darkColors: ColorTokens = {
  background: '222 30% 9%',
  foreground: '210 40% 96%',
  card: '222 26% 12%',
  cardForeground: '210 40% 96%',
  muted: '217 25% 18%',
  mutedForeground: '215 20% 65%',
  border: '217 25% 20%',
  input: '217 25% 22%',
  primary: '215 75% 60%',
  primaryForeground: '222 47% 11%',
  accent: '38 92% 55%',
  accentForeground: '222 47% 11%',
  destructive: '0 63% 50%',
  destructiveForeground: '0 0% 100%',
  success: '142 55% 48%',
  warning: '38 92% 55%',
  ring: '215 75% 60%',
};

/** Border radius (DESIGN §2 — rounded-lg default). */
export const radius = '0.625rem';

/** Typography (DESIGN §3) — fleet default IBM Plex Sans + JetBrains Mono. */
export const fonts = {
  sans: '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

/** Semantic status → token name (DESIGN §2): task/project/leave states. */
export const semanticStatus = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
} as const;

export const tokens = {
  light: lightColors,
  dark: darkColors,
  radius,
  fonts,
  semanticStatus,
} as const;

const cssVarName = (key: keyof ColorTokens): string =>
  `--${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;

/** Render a color set as `--token: H S% L%;` declarations (one per line). */
export function colorsToCssVariables(colors: ColorTokens): string {
  return (Object.keys(colors) as Array<keyof ColorTokens>)
    .map((key) => `  ${cssVarName(key)}: ${colors[key]};`)
    .join('\n');
}
