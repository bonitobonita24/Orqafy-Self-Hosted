// Test stub. The real `server-only` package throws when imported outside an RSC
// bundler; under the vitest node environment it is aliased here to a no-op so
// server-side modules (e.g. lib/mobile-token) can be unit-tested. See
// vitest.config.ts. Outside src/**, so it is not typechecked or linted.
export {};
