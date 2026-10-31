// Bundles the worker (src/main.ts + the @orqafy/{db,shared,storage} workspace
// sources it imports) into ONE ESM file for the Docker runtime image.
// Kept external (installed as real node_modules in the image):
//   - @prisma/client : requires the generated `.prisma/client` query engine
//   - bullmq         : ships Lua scripts / child-process helpers resolved from disk
import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  external: ['@prisma/client', 'bullmq'],
  // CJS-only deps pulled into the bundle may call require(); give ESM a real one.
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
  logLevel: 'info',
});
