-- Enforce the D-5 single-organization invariant: there is EXACTLY ONE
-- Organization row for the lifetime of a self-hosted install. Prior to this
-- migration, `setup.ts` (first-run) ALWAYS inserted a brand-new row even
-- when the dev seed (`seed.ts`) had already created one via a fixed-id
-- upsert ('org_default') — so an install that ran both ended up with TWO
-- rows. Every reader (`org.ts`, `retention.ts`) used a bare
-- `findFirst()` with no `orderBy`, so a settings read and a settings write
-- could silently hit DIFFERENT rows (the "my settings don't save" bug).
--
-- This migration is idempotent and safe to run against an install that
-- already has exactly one (or zero) Organization rows — both steps below
-- are no-ops in that case.

-- 1. DATA REPAIR — collapse to one row. Keep the row with the most
--    "configured" signals (dpoName / retentionSettings / address / logoKey
--    — proof an operator actually used it), tie-broken by most recently
--    updated, tie-broken by the oldest row (stable id convention). There
--    are no foreign keys onto "Organization" (verified against
--    schema.prisma — no model references it), so deleting the losing
--    row(s) is safe with no orphaned relations.
DO $$
DECLARE
  keep_id TEXT;
BEGIN
  SELECT id INTO keep_id
  FROM "Organization"
  ORDER BY
    (
      (CASE WHEN "dpoName" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "retentionSettings" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "address" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "logoKey" IS NOT NULL THEN 1 ELSE 0 END)
    ) DESC,
    "updatedAt" DESC,
    "createdAt" ASC
  LIMIT 1;

  IF keep_id IS NOT NULL THEN
    DELETE FROM "Organization" WHERE id <> keep_id;
  END IF;
END $$;

-- 2. DB-LEVEL GUARD — a unique index on a constant expression. Every row
--    evaluates the boolean literal `true` identically, so Postgres' unique
--    check rejects any INSERT past the first row: the single-organization
--    invariant becomes impossible to violate at the database layer, not
--    just a convention application code has to remember (seed.ts / setup.ts).
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_singleton_uq" ON "Organization" ((true));
