# Vendored brand fonts (self-hosted)

Self-hosted woff2 subsets for the two Orqafy brand faces (DESIGN.md §3). Loaded via
`next/font/local` in `../lib/fonts.ts` and bound to `--font-sans` / `--font-mono`.
Vendored so the app makes **no external font request** at build or runtime
(offline/self-hosted-first, D-3; and no Google Fonts dependency in an AGPL public repo).

| Family         | Weights       | Subset | License        |
| -------------- | ------------- | ------ | -------------- |
| IBM Plex Sans  | 400, 500, 600 | latin  | SIL OFL 1.1    |
| JetBrains Mono | 400, 500, 600 | latin  | SIL OFL 1.1    |

Weights are scoped to what the UI actually uses (`font-medium` = 500, `font-semibold`
= 600, body = 400). Files are the fontsource latin-subset builds
(`@fontsource/ibm-plex-sans`, `@fontsource/jetbrains-mono`). The full OFL 1.1 license
text for each family travels with the fonts here: `LICENSE-ibm-plex-sans.txt`,
`LICENSE-jetbrains-mono.txt`.
