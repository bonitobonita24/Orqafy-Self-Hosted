import type { MetadataRoute } from 'next';

// Rule 35 SEO Foundation (.ai_prompt/seo.md §1, §2.2). Same index-policy
// decision as app/robots.ts: Orqafy has no public marketing surface, so there
// is no indexable route to list — an intentionally empty sitemap, not a gap.
// If a future PRODUCT.md change adds a real public surface (e.g. a marketing
// site), list its routes here and flip the corresponding route's `robots`
// metadata + app/robots.ts `disallow` rule per the adaptive table in
// .ai_prompt/seo.md §1.
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
