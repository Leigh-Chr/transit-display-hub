import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility smoke tests (axe-core).
 *
 * Baseline established 2026-05-11 — violations pinned as soft assertions so
 * pre-existing issues surface as warnings rather than hard failures. Any
 * NEW critical/serious violation above the baseline will break CI.
 *
 * Baseline counts:
 *   /login      → 0 critical/serious violations
 *   /map        → 0 critical/serious violations
 *   /map/list   → 0 critical/serious violations
 */

const publicPages = [
  { path: '/login',     name: 'login' },
  { path: '/map',       name: 'network-map' },
  { path: '/map/list',  name: 'network-list' },
];

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Per-page baseline: update when a pre-existing violation is fixed.
const BASELINE: Record<string, number> = {
  login:        0,
  'network-map':  0,
  'network-list': 0,
};

for (const p of publicPages) {
  test(`${p.name} has no axe-detected critical/serious violations`, async ({ page }) => {
    await page.goto(p.path, { waitUntil: 'networkidle' });

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();

    const critical = results.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious',
    );

    // Soft assertion against the baseline so existing issues don't block CI
    // while still failing on regressions above it.
    expect.soft(
      critical.length,
      `${p.name}: ${critical.length} critical/serious violation(s) found:\n` +
        JSON.stringify(critical.map(v => ({ id: v.id, impact: v.impact, description: v.description })), null, 2),
    ).toBeLessThanOrEqual(BASELINE[p.name] ?? 0);
  });
}
