// Server page carrying this route's metadata (Rule 35 — .ai_prompt/seo.md §1).
// `next.js` only allows `metadata`/`generateMetadata` exports from a Server
// Component, and the sign-in form itself needs client state/handlers — so the
// form lives in the sibling 'use client' file and this file re-exports it as
// the route's default, the exact pattern Next.js documents/tests for pairing
// static metadata with a client-rendered page.
import type { Metadata } from 'next';
import LoginPageContent from './login-page-content';

// Index policy (documented, see app/layout.tsx + app/robots.ts + app/sitemap.ts
// for the rest of this decision): noindex,nofollow — Orqafy has no public
// marketing surface (D-5 single-org self-hosted app); the sign-in page is
// install-specific and not meant to rank in search. Title/description/
// canonical/OG are still set for a clean link preview when an operator shares
// this install's login URL internally (Slack/Teams/email unfurl).
export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your Orqafy install.',
  alternates: { canonical: '/login' },
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Sign in · Orqafy',
    description: 'Sign in to your Orqafy install.',
    url: '/login',
    siteName: 'Orqafy',
    type: 'website',
  },
  twitter: { card: 'summary' },
};

export default LoginPageContent;
