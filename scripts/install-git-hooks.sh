#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Install local git hooks for Orqafy Self-Hosted.
#
# Git hooks live in .git/hooks (NOT version-controlled), so every clone must
# run this once. It wires:
#   pre-commit -> scripts/check-public-assets.sh --staged   (asset guard)
#   pre-push   -> scripts/check-public-assets.sh --tracked  (asset guard)
#
# Idempotent: re-running overwrites the managed hooks in place.
# ---------------------------------------------------------------------------
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOK_DIR="$REPO_ROOT/.git/hooks"
mkdir -p "$HOOK_DIR"

chmod +x "$REPO_ROOT/scripts/check-public-assets.sh"

cat > "$HOOK_DIR/pre-commit" <<'HOOK'
#!/usr/bin/env bash
# managed by scripts/install-git-hooks.sh — public-repo asset guard
set -euo pipefail
"$(git rev-parse --show-toplevel)/scripts/check-public-assets.sh" --staged
HOOK

cat > "$HOOK_DIR/pre-push" <<'HOOK'
#!/usr/bin/env bash
# managed by scripts/install-git-hooks.sh — public-repo asset guard
set -euo pipefail
"$(git rev-parse --show-toplevel)/scripts/check-public-assets.sh" --tracked
HOOK

chmod +x "$HOOK_DIR/pre-commit" "$HOOK_DIR/pre-push"

echo "✓ installed pre-commit + pre-push asset guards into $HOOK_DIR"
