// @orqafy/web — Next.js config.
// Workspace source packages are compiled by Next (transpilePackages); Prisma's
// engine stays external so it is not bundled. ESLint runs as its own turbo task
// (`pnpm lint`), not inside `next build` — the monorepo owns one ESLint config.
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
};

export default nextConfig;
