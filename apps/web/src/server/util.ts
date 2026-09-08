// Small server helpers.
import 'server-only';

type NoUndefined<T> = { [K in keyof T]?: Exclude<T[K], undefined> };

/**
 * Strip `undefined` values from an object so it can be spread into a Prisma
 * `data` payload under `exactOptionalPropertyTypes` (which forbids explicitly
 * assigning `undefined` to an optional field — the key must be absent instead).
 */
export function omitUndefined<T extends Record<string, unknown>>(obj: T): NoUndefined<T> {
  const out: NoUndefined<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    const value = obj[key];
    if (value !== undefined) {
      out[key] = value as Exclude<T[typeof key], undefined>;
    }
  }
  return out;
}
