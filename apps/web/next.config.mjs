// @orqafy/web — Next.js config.
// Workspace source packages are compiled by Next (transpilePackages); Prisma's
// engine stays external so it is not bundled. ESLint runs as its own turbo task
// (`pnpm lint`), not inside `next build` — the monorepo owns one ESLint config.
import { buildHeadersConfig } from './src/lib/security-headers.ts';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@orqafy/ui', '@orqafy/shared', '@orqafy/db'],
  serverExternalPackages: ['@prisma/client', '.prisma/client', 'bcryptjs'],
  eslint: {
    // Linting is a separate workspace gate (`pnpm lint` via turbo + root ESLint).
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Type errors MUST fail the build — this is a real static gate.
    ignoreBuildErrors: false,
  },
  // Security response headers (audit M-3) — CSP, HSTS, nosniff, Referrer-Policy,
  // frame protection — applied to every route. Logic lives in
  // src/lib/security-headers.ts (also unit-tested there).
  async headers() {
    return buildHeadersConfig();
  },
  webpack: (config, { webpack }) => {
    // BullMQ (pulled in via @orqafy/jobs) references an optional Valkey Glide
    // client we never use — we run the default ioredis path. Ignore the module
    // so the server build stops emitting a "Can't resolve @valkey/valkey-glide"
    // warning. Runtime is unaffected (the code path is never taken).
    config.plugins.push(
      new webpack.IgnorePlugin({ resourceRegExp: /^@valkey\/valkey-glide$/ }),
    );
    return config;
  },
};

export default nextConfig;
