import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Node-environment unit tests for server-side lib logic (currently the mobile
// bearer-token sign/verify). `server-only` throws when imported outside an RSC
// bundler, so it is aliased to a no-op stub for the node test environment.
const serverOnlyStub = fileURLToPath(new URL('./test/server-only.stub.ts', import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
    alias: { 'server-only': serverOnlyStub },
  },
});
