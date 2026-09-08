# Lessons Memory — Orqafy Self-Hosted (Spec-Driven Platform V32)
# Entry format: ## YYYY-MM-DD — [ICON] [Title]
# Types: 🔴 gotcha | 🟡 fix | 🟤 decision | ⚖️ trade-off | 🟢 change
# READ ORDER: 🔴 first → 🟤 second → rest by relevance
# ---

## BOOTSTRAP — 🔴 WSL2 + Docker Desktop known pitfalls
- Type:      🔴 gotcha
- Phase:     Phase 0 Bootstrap / Phase 1 dev environment open
- Files:     .env.dev, docker-compose.*.yml, .nvmrc
- Concepts:  wsl2, docker-desktop, pnpm, nvm, permissions
- Narrative: Real failures on WSL2 + Docker Desktop. All fixes baked into Bootstrap template.
  (1) Never use corepack enable — use npm install -g pnpm. corepack symlinks fail in some WSL2 setups.
  (2) pnpm install must run from WSL2 terminal — not Windows PowerShell or CMD.
  (3) Docker Desktop must be running before any docker compose command. Check with: docker ps.
  (4) Port conflicts: dev services use non-standard random ports (Rule 22). If conflict occurs,
      regenerate ports in inputs.yml → run Phase 7 → restart services.
  (5) nvm must be sourced in .bashrc — add: [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  (6) WSL2 file permissions: always develop inside WSL2 filesystem (/home/user/) not /mnt/c/.
      Working in /mnt/c/ causes severe pnpm and docker performance issues.
# ---

## 2026-09-08 — 🔴 AGPL public repo: NEVER commit framework/paid IP
- Type:      🔴 gotcha
- Phase:     Phase 0 Bootstrap (Orqafy-specific, D-2)
- Files:     .gitignore, scripts/check-public-assets.sh
- Concepts:  agpl, public-repo, asset-guard, framework-boundary
- Narrative: Orqafy is built WITH the AIEF framework but ships WITHOUT it (D-2, AGPL-3.0, public).
  The following are seeded LOCALLY and gitignored + guarded — never commit: CLAUDE.md, .ai_prompt/,
  AI/, starter/admincn/, .claude/, .sessions/, .github/skills/, .mcp.json, .vscode/,
  .socraticodecontextartifacts.json, docs/tasks/phase4-part*.md, and the framework scripts in
  scripts/ (design-stop-hook, sync-context, spec-gap-check, build-primer, dev-freshness-check,
  lint-deploy, lint-design, audit-app, audit-scope.mjs, review-scope.mjs, design-fidelity.mjs,
  design-validate.mjs) + root sd.config.mjs / design-fidelity.config.json. The app's OWN scripts
  (check-public-assets.sh, install-git-hooks.sh) STAY tracked. Guard: bash scripts/check-public-assets.sh
  --tracked (CI/pre-push) + --staged (pre-commit). Run --tracked green after any framework sync.
# ---
