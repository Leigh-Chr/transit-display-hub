#!/usr/bin/env bash
# Maintainability guardrail — flag human-readable strings baked into
# Angular templates or component code instead of routed through Transloco.
# Three audits in a row have flagged the same regression after a marathon
# refactor; this script catches it before the next one lands.
#
# Detection rules — kept narrow so false positives stay rare:
#
#   1. Templates: matTooltip / aria-label assigned to a literal that
#      begins with a capital letter and contains a space ("Quai" alone
#      can be a technical attribute value; "Open menu" is UI text).
#   2. Component TS: ariaLabel: '…' or ariaLabel: `…` set to a literal
#      starting with a capital letter (MatDialogConfig surfaces this).
#   3. Component TS: signal/subject setters whose first word is a
#      stereotyped English UI verb (Failed/Loading/Unable/Could/Cannot).
#
# Allowlist file: scripts/i18n-hardcoded-allowlist.txt. Each line is a
# fully-qualified "path:line" pair, with optional "#" comment. Entries
# are exempt — but please justify (jargon, third-party, test fixture).

set -uo pipefail
cd "$(dirname "$0")/.."

ALLOWLIST="scripts/i18n-hardcoded-allowlist.txt"
declare -A ALLOWED
if [ -f "$ALLOWLIST" ]; then
    while IFS= read -r line; do
        entry="${line%%#*}"
        entry="$(printf '%s' "$entry" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
        [ -n "$entry" ] || continue
        ALLOWED["$entry"]=1
    done < "$ALLOWLIST"
fi

violations=0

report_hits() {
    local label="$1" hits="$2"
    [ -z "$hits" ] && return 0
    while IFS= read -r line; do
        local key="${line%%:*}:$(printf '%s' "$line" | awk -F: '{print $2}')"
        if [ -n "${ALLOWED[$key]:-}" ]; then
            continue
        fi
        echo "  [$label] $line"
        violations=$((violations + 1))
    done <<< "$hits"
}

echo "Scanning HTML templates for matTooltip=\"Literal\"…"
hits=$(grep -RnE 'matTooltip="[A-Z][^"]* [^"]+"' frontend/src --include='*.html' 2>/dev/null || true)
report_hits "matTooltip" "$hits"

echo "Scanning HTML templates for aria-label=\"Literal\"…"
hits=$(grep -RnE 'aria-label="[A-Z][^"]* [^"]+"' frontend/src --include='*.html' 2>/dev/null || true)
report_hits "aria-label" "$hits"

echo "Scanning component TS for ariaLabel: 'Literal'…"
# shellcheck disable=SC1003
hits=$(grep -RnE "ariaLabel:[[:space:]]*[\`'\"][A-Z][^\"\`']*( [^\"\`']+)" frontend/src --include='*.ts' --exclude='*.spec.ts' 2>/dev/null || true)
report_hits "ariaLabel" "$hits"

echo "Scanning component TS for .set('Failed/Loading/Unable …')…"
# shellcheck disable=SC1003
hits=$(grep -RnE "\\.set\\([\`'\"](Failed|Loading|Unable|Could not|Cannot) " frontend/src --include='*.ts' --exclude='*.spec.ts' 2>/dev/null || true)
report_hits "signal-setter" "$hits"

echo ""
if [ "$violations" -gt 0 ]; then
    cat <<MSG
$violations hardcoded human-readable string(s) found.

Route each one through Transloco:
  HTML:   matTooltip="Quai"          →  [matTooltip]="t('feature.tooltipKey')"
  HTML:   aria-label="Open menu"      →  [attr.aria-label]="t('feature.openMenuAria')"
  TS:     ariaLabel: \`Hello \${x}\`    →  ariaLabel: this.transloco.translate('key', { x })
  TS:     this.error.set('Failed …')  →  this.error.set(this.transloco.translate('key'))

Add the matching keys to both frontend/src/assets/i18n/{fr,en}.json so
the FR/EN suite stays balanced (the project asserts 0 drift).

If a hit is truly a non-translatable jargon string (GTFS field name,
third-party id, etc.), append "path:line" to scripts/i18n-hardcoded-allowlist.txt
with a one-line justification.
MSG
    exit 1
fi

echo "No hardcoded i18n strings detected."
exit 0
