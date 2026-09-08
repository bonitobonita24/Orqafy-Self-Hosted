// Shared primitive schemas / value objects reused across entities.
// Pure Zod — no database or server imports (Phase 4 Part 2 layering rule).
import { z } from 'zod';

/**
 * Canonical entity id. The concrete id strategy (cuid vs uuid) is finalised in
 * Part 3 (Prisma). Here it is a non-empty string so every schema can reference
 * foreign keys without prejudging that decision.
 */
export const idSchema = z.string().min(1);

/** Email address (lowercased/normalised by the API boundary, not here). */
export const emailSchema = z.string().email();

/** Optional-but-non-empty free text used for names/titles. */
export const nonEmptyString = z.string().min(1);

/**
 * Geofence anchor for a site Task (D-19): a coordinate pair plus the dwell
 * radius. Evaluated on-device, presence-only; no location history is stored.
 */
export const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusMeters: z.number().positive(),
});
export type Location = z.infer<typeof locationSchema>;
