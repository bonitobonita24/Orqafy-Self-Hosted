#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Public-repo asset guard (decision D-2: AGPL-3.0, public repo).
#
# Orqafy Self-Hosted is BUILT with the AIEF framework but must SHIP WITHOUT it.
# This guard hard-fails if any framework IP or the paid AdminCN template slice
# is about to enter git history. .gitignore prevents accidental `git add .`;
# this guard also catches `git add -f` and files that were tracked before the
# ignore rule existed.
#
# Modes:
#   (default / --staged)  check the staged index      -> use in pre-commit
#   --tracked             check the whole tracked tree -> use in pre-push / CI
#
# Exit 0 = clean, exit 1 = a forbidden path was found (commit/push refused).
# ---------------------------------------------------------------------------
set -euo pipefail

# Forbidden path prefixes/files. A match anywhere in these is refused.
# ⚠ KEEP IN SYNC with the "PUBLIC-REPO ASSET GUARD" block in .gitignore — the two
# lists are a deliberate belt-and-suspenders pair (ignore = accident, this = enforcement).
# Matching is case-insensitive so a .AI_Prompt/ variant cannot slip past on a
# case-insensitive filesystem (macOS/Windows).
FORBIDDEN=(
  ".ai_prompt/"      # AIEF framework prompt IP
  "ai/"              # AIEF framework assets (matches AI/)
  "starter/admincn/" # paid AdminCN template slice
  ".claude/"         # local Claude Code config
  ".sessions/"       # local loop/session handoff state (internal FOCUS notes)
  "claude.md"        # framework/seat instructions (kept local only)
  # ── P0.1 (2026-09-08): framework tooling / IP seeded by bootstrap + deploy.sh ──
  ".github/skills/"                    # AIEF framework skill IP (bootstrap Step 17)
  ".clinerules"                        # framework tombstone (bootstrap Step 3)
  ".socraticodecontextartifacts.json"  # framework context artifact
  ".mcp.json"                          # framework MCP config (bootstrap Step 10)
  ".vscode/"                           # framework editor/MCP config (bootstrap Step 10)
  "docs/tasks/phase4-part"             # framework build-methodology task files (bootstrap Step 4)
  # Framework-owned scripts (deploy.sh / bootstrap install into scripts/). The app's own
  # check-public-assets.sh + install-git-hooks.sh stay TRACKED — enumerate, never blanket scripts/.
  "scripts/lint-deploy.sh"
  "scripts/design-stop-hook.sh"
  "scripts/lint-design.sh"
  "scripts/sync-context.sh"
  "scripts/spec-gap-check.sh"
  "scripts/design-fidelity.mjs"
  "scripts/design-validate.mjs"
  "scripts/audit-app.sh"
  "scripts/dev-freshness-check.sh"
  "scripts/build-primer.sh"
  "scripts/review-scope.mjs"
  "scripts/audit-scope.mjs"
  # ── V32.65 HAR harvest additions (2026-10-21 sync) — more framework-owned scripts/config ──
  "scripts/verify-record.sh"
  "scripts/readiness-smoke.sh"
  "scripts/run-stages.mjs"
  "scripts/stages.json"
  "scripts/validate-findings.mjs"
  "scripts/report-schema.json"
  # Framework deploy entrypoint, seeded at repo root by sync-to-project.sh
  "deploy.sh"
  # Capability-primer regenerator sources (build-primer.sh scaffolds/overwrites these)
  "docs/primer.yml"
  "docs/capability_primer.md"
  # Framework design-toolkit config seeded at repo root (bootstrap Step 20)
  "sd.config.mjs"
  "design-fidelity.config.json"
)

MODE="${1:---staged}"

case "$MODE" in
  --staged)
    # Added/copied/modified/renamed names in the staged index.
    mapfile -t FILES < <(git diff --cached --name-only --diff-filter=ACMR)
    CONTEXT="staged for commit"
    ;;
  --tracked)
    mapfile -t FILES < <(git ls-files)
    CONTEXT="tracked in the repo"
    ;;
  *)
    echo "usage: $(basename "$0") [--staged|--tracked]" >&2
    exit 2
    ;;
esac

HITS=()
for f in "${FILES[@]}"; do
  lf="${f,,}"                         # lowercase for case-insensitive compare
  for bad in "${FORBIDDEN[@]}"; do    # FORBIDDEN entries are already lowercase
    # Match a top-level file (CLAUDE.md) or anything under a forbidden dir prefix.
    if [[ "$lf" == "$bad" || "$lf" == "$bad"* ]]; then
      HITS+=("$f")
      break
    fi
  done
  # ── V32.65 HAR harvest additions (2026-10-21 sync) — deploy.sh's overwrite_with_backup()
  # leaves a timestamped *.<TIMESTAMP>.bak sibling next to EVERY framework-owned file it
  # overwrites (scripts/ + root files not caught by the .ai_prompt//.claude//AI/ directory
  # ignores). Those backups carry the same framework IP as the original — catch any such
  # backup generically so a future deliverable never needs its own enumerated .bak entry.
  if [[ "$lf" =~ \.[0-9]{8}_[0-9]{6}\.bak$ ]]; then
    HITS+=("$f")
  fi
done

if (( ${#HITS[@]} > 0 )); then
  echo "✗ PUBLIC-REPO ASSET GUARD: refused — framework/paid IP $CONTEXT:" >&2
  for h in "${HITS[@]}"; do echo "    $h" >&2; done
  echo "" >&2
  echo "  This repo is AGPL-3.0 public (D-2). It must not carry AIEF framework files" >&2
  echo "  or the paid AdminCN slice. Unstage these (git restore --staged <path>) or" >&2
  echo "  remove them from tracking (git rm --cached <path>). See docs/STATE.md." >&2
  exit 1
fi

echo "✓ asset guard clean ($CONTEXT)"
exit 0
