#!/usr/bin/env bash
# Maintainability guardrail — flag source files that grow past the
# agreed ceiling. Designed to be run from the repo root, both in CI
# and locally.
#
# Phase 1 maintainability guardrails — see
# .planning/refactors/2026-05-12-maintainability-guardrails.md
#
# Thresholds (block = build fails, warn = printed but green):
#
#   *.component.ts                         block >  950   warn > 600
#   *.ts (non-spec, non-component)         block >  700   warn > 500
#   *.scss                                 block > 1100   warn > 700
#   *Importer.java / *Calculator.java      block >  650   warn > 500
#   *Service.java / *Controller.java       block >  500   warn > 400
#
# Files listed in scripts/oversized-allowlist.txt are exempt from
# the block but still printed (as INFO when they fall back under the
# threshold, to nudge the author to remove the allowlist entry in
# the same commit as the refactor).

set -uo pipefail
cd "$(dirname "$0")/.."

ALLOWLIST="scripts/oversized-allowlist.txt"
declare -A ALLOWED
if [ -f "$ALLOWLIST" ]; then
    while IFS= read -r line; do
        path="${line%%#*}"
        # trim leading/trailing whitespace
        path="$(printf '%s' "$path" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
        [ -n "$path" ] || continue
        ALLOWED["$path"]=1
    done < "$ALLOWLIST"
fi

block_count=0
warn_count=0
back_under=0

check_path() {
    local path="$1" block="$2" warn="$3"
    [ -f "$path" ] || return 0
    local lines
    lines=$(wc -l < "$path")
    if [ -n "${ALLOWED[$path]:-}" ]; then
        if [ "$lines" -le "$block" ]; then
            printf "  INFO  %s : %d lines — back under %d, remove from %s\n" \
                "$path" "$lines" "$block" "$ALLOWLIST"
            back_under=$((back_under + 1))
        fi
        return 0
    fi
    if [ "$lines" -gt "$block" ]; then
        printf "  BLOCK %s : %d lines > %d\n" "$path" "$lines" "$block"
        block_count=$((block_count + 1))
    elif [ "$lines" -gt "$warn" ]; then
        printf "  warn  %s : %d lines > %d\n" "$path" "$lines" "$warn"
        warn_count=$((warn_count + 1))
    fi
}

echo "Checking frontend components and TypeScript modules…"
while IFS= read -r f; do
    check_path "$f" 950 600
done < <(find frontend/src -type f -name '*.component.ts' ! -name '*.spec.ts' 2>/dev/null)

while IFS= read -r f; do
    check_path "$f" 700 500
done < <(find frontend/src -type f -name '*.ts' ! -name '*.spec.ts' ! -name '*.component.ts' 2>/dev/null)

echo "Checking frontend stylesheets…"
while IFS= read -r f; do
    check_path "$f" 1100 700
done < <(find frontend/src -type f -name '*.scss' 2>/dev/null)

echo "Checking backend Java sources…"
while IFS= read -r f; do
    case "$f" in
        */build/*|*/generated/*) continue ;;
        *Importer.java|*Calculator.java)
            check_path "$f" 650 500
            ;;
        *Service.java|*Controller.java)
            check_path "$f" 500 400
            ;;
    esac
done < <(find backend/src/main/java -type f -name '*.java' 2>/dev/null)

echo ""
echo "Summary: $block_count blocking violation(s), $warn_count warning(s), $back_under allowlist entries below threshold."

if [ "$block_count" -gt 0 ]; then
    cat <<MSG

A file grew past the ceiling. Either:
  1. Reduce it (preferred — extract sub-components / sub-services), or
  2. Add it to scripts/oversized-allowlist.txt together with a planned
     phase that will bring it back under (see
     .planning/refactors/2026-05-12-maintainability-guardrails.md).

The allowlist exists to acknowledge known monoliths, not to grow.
MSG
    exit 1
fi

exit 0
