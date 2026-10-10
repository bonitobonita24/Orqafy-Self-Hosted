// Single-organization lookup helper (D-5: this is a single-company self-hosted
// install — there is exactly ONE Organization row for the lifetime of an
// install). Centralized here (not duplicated per-caller) because BOTH
// apps/web (org.ts settings router) and packages/jobs (retention.ts sweep)
// read the singleton row, and a bare `findFirst()` with no `orderBy` gives
// Postgres no ordering guarantee — two callers can observe DIFFERENT rows
// if more than one ever exists, which is exactly how the save/read-back
// settings bug surfaced (two Organization rows: a stale seed row + the
// real first-run-configured row).
//
// `orderBy: { createdAt: 'asc' }` is the deterministic tie-breaker: the
// OLDEST row wins ties. A DB-level guard (a unique index on a constant
// expression — see migration `enforce_single_organization_row`) now makes
// a second row impossible going forward; this helper is the defense-in-depth
// read-side guarantee for any pre-existing / not-yet-migrated data.
import type { Prisma, PrismaClient, Organization } from '@prisma/client';

type OrgClient = PrismaClient | Prisma.TransactionClient;

/** The single Organization row, or `null` if the install hasn't been set up yet. */
export async function getOrganization(db: OrgClient): Promise<Organization | null> {
  return db.organization.findFirst({ orderBy: { createdAt: 'asc' } });
}

/** Same as {@link getOrganization}, but throws if the install has no org yet. */
export async function getOrganizationOrThrow(db: OrgClient): Promise<Organization> {
  const org = await getOrganization(db);
  if (org === null) {
    throw new Error('No Organization row found — first-run setup has not completed.');
  }
  return org;
}
