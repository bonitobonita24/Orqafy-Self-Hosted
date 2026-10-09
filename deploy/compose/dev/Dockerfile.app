# Dev image for @orqafy/web (Next.js). dev_build:true — built from source, no
# registry (docker.publish:false). Runs `next dev` with hot reload; the repo is
# baked in at build time (bind-mount a source volume for live editing if desired).
FROM node:22-alpine

# Prisma engines + build tooling on Alpine.
RUN apk add --no-cache libc6-compat openssl bash \
  && apk upgrade --no-cache

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app
COPY . .

RUN pnpm install --frozen-lockfile \
  && pnpm --filter @orqafy/db exec prisma generate

# Drop npm's bundled tree (audit H-5) — carries CRITICAL tar/pacote/sigstore/
# brace-expansion CVEs and never runs at runtime (corepack->pnpm only, not npm).
# Must run AFTER pnpm install; corepack is a separate bundle, unaffected.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

EXPOSE 56483
# Next binds 0.0.0.0 by default; port pinned to the Rule-22 dev port.
CMD ["pnpm", "--filter", "@orqafy/web", "dev"]
