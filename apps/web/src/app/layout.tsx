import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { fontSans, fontMono } from '@/lib/fonts';
import { resolveSiteUrl } from '@/lib/site-url';
import './globals.css';

// Typeface: DESIGN.md sets IBM Plex Sans (UI) + JetBrains Mono (figures), self-hosted
// via next/font/local from vendored OFL woff2 (see src/lib/fonts.ts). The generated
// classes bind --font-sans / --font-mono on <html>, overriding the system-font
// fallbacks in @orqafy/ui/theme/globals.css — no external font request at runtime.
//
// Rule 35 SEO Foundation (adaptive baseline): Orqafy is a self-hosted,
// single-org app (D-5) with no public marketing surface — every route,
// including /login and /setup, is a private operational surface for the one
// deployed organisation, never meant to be found via search. The ROOT default
// is therefore noindex/nofollow (fail-closed per .ai_prompt/seo.md §1); /login
// and /setup set their own metadata (title/description/canonical/OG) for
// clean link previews (e.g. an internal chat sharing the install's login URL)
// but inherit this same noindex posture — see app/login/page.tsx,
// app/setup/page.tsx, app/robots.ts, app/sitemap.ts for the consistent
// disallow-everything / empty-sitemap implementation of that single decision.
export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteUrl()),
  title: { default: 'Orqafy', template: '%s · Orqafy' },
  description: 'Self-hosted construction project management, file sync, and geofenced site tasks.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fontSans.variable} ${fontMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
