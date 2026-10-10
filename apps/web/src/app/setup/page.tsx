// Server page carrying this route's metadata (Rule 35 — .ai_prompt/seo.md §1).
// Same split as app/login/page.tsx: the first-run setup form needs client
// state/handlers, so it lives in the sibling 'use client' file and this file
// re-exports it as the route's default alongside the static `metadata` export.
import type { Metadata } from 'next';
import SetupPageContent from './setup-page-content';

// Index policy: noindex,nofollow — same decision + rationale as
// app/login/page.tsx (no public marketing surface; install-specific,
// not meant to rank in search). Title/description/canonical/OG kept for a
// clean internal link preview only.
export const metadata: Metadata = {
  title: 'First-run setup',
  description: 'Create the first administrator account for this Orqafy install.',
  alternates: { canonical: '/setup' },
  robots: { index: false, follow: false },
  openGraph: {
    title: 'First-run setup · Orqafy',
    description: 'Create the first administrator account for this Orqafy install.',
    url: '/setup',
    siteName: 'Orqafy',
    type: 'website',
  },
  twitter: { card: 'summary' },
};

export default SetupPageContent;
