import type { MetadataRoute } from 'next';

// Rule 35 SEO Foundation (.ai_prompt/seo.md §1, §2.3). Index policy decision
// (same one documented in app/layout.tsx + app/login/page.tsx +
// app/setup/page.tsx + app/sitemap.ts): Orqafy has NO public marketing
// surface — every route, /login and /setup included, is a private
// operational surface for the one deployed organisation (D-5 single-org
// self-hosted app) and is never meant to be crawled or indexed. So instead of
// the adaptive per-route allow/disallow split .ai_prompt/seo.md §1 describes
// for apps that DO have a public surface, this disallows everything,
// consistently with every route's `robots: { index: false, follow: false }`
// metadata and the empty app/sitemap.ts.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '/',
    },
  };
}
