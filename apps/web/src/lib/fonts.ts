/**
 * Self-hosted brand typefaces (DESIGN.md §3 / fleet default): IBM Plex Sans (UI /
 * body) + JetBrains Mono (figures / codes). Loaded via `next/font/local` from the
 * woff2 subset files vendored in `../fonts/` — NO external font CDN / Google Fonts
 * request at build OR runtime. This matters twice over for Orqafy: it is
 * offline/self-hosted-first (D-3), and an AGPL-3.0 public repo must not carry a
 * Google Fonts network dependency. Both faces are SIL OFL 1.1 (see the LICENSE-*.txt
 * beside the woff2), so vendoring them in a public repo is permitted.
 *
 * Weights are scoped to what the app actually renders: 400 (body), 500 (`font-medium`
 * labels), 600 (`font-semibold` headings). No 700 face is used anywhere in the UI.
 *
 * `variable` exposes each face as its own CSS custom property (`--font-plex-sans` /
 * `--font-jetbrains-mono`) applied to <html>. The design tokens consume those via the
 * var() fallback form in `--font-sans` / `--font-mono` (@orqafy/ui/theme/globals.css),
 * so the self-hosted face wins with the literal-name + system stack as the fallback if
 * an app hasn't wired next/font. Distinct names (not `--font-sans` itself) avoid an
 * equal-specificity cascade clash with the :root token declaration.
 */
import localFont from 'next/font/local';

export const fontSans = localFont({
  src: [
    { path: '../fonts/ibm-plex-sans-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/ibm-plex-sans-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/ibm-plex-sans-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-plex-sans',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
});

export const fontMono = localFont({
  src: [
    { path: '../fonts/jetbrains-mono-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/jetbrains-mono-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/jetbrains-mono-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
});
