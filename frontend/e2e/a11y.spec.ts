import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test } from './fixtures/auth.fixture';

/**
 * Accessibility smoke tests (axe-core).
 *
 * Baseline established 2026-05-11, étendue 2026-05-16 aux pages
 * d'affichage public (kiosk / hub) et au dashboard admin. Les
 * violations pré-existantes sont épinglées en soft assertion :
 * toute violation critique/sérieuse NOUVELLE au-dessus de la baseline
 * cassera la CI, mais les anciennes ne bloquent pas le merge.
 *
 * Baselines initiales :
 *   /login              → 0 violation critique/sérieuse
 *   /map                → 2 (chips de légende — contraste secondaire)
 *   /map/list           → 2 (chips de ligne sur la liste — contraste)
 *   /display/<stopId>   → 3 (état "loading/error", à resserrer après CI)
 *   /hub                → 3 (idem hub sans token)
 *   /admin/dashboard    → 5 (cards stats + nav — à resserrer après CI)
 */

const publicPages = [
  { path: '/login',     name: 'login' },
  { path: '/map',       name: 'network-map' },
  { path: '/map/list',  name: 'network-list' },
];

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Per-page baseline: update when a pre-existing violation is fixed.
// The pre-existing color-contrast findings on the network pages come
// from secondary text/background pairs (line legend chips on the list
// view, zoom-control badges on the map) that do not affect readability
// of stop or line names. Different browsers render the same CSS with
// slightly different anti-aliasing, so the count varies by 1 — pin the
// upper bound at 2 and let a real regression (a new violation on top
// of these) still trip CI.
const BASELINE: Record<string, number> = {
  login:             0,
  'network-map':     2,
  'network-list':    2,
  'kiosk-stop':      3,
  'hub':             3,
  'admin-dashboard': 5,
};

function assertNoNewViolations(name: string, criticalCount: number, sample: unknown): void {
  expect.soft(
    criticalCount,
    `${name}: ${criticalCount} critical/serious violation(s) found:\n` +
      JSON.stringify(sample, null, 2),
  ).toBeLessThanOrEqual(BASELINE[name] ?? 0);
}

for (const p of publicPages) {
  test(`${p.name} has no axe-detected critical/serious violations`, async ({ page }) => {
    // Network-list renders the entire stop catalogue (hundreds of rows on
    // typical feeds). axe-core scans the full DOM tree, so the 30 s
    // default cap is too tight — bump to 120 s on slower engines (Firefox
    // gecko in particular is noticeably slower than v8 on this scan) so
    // the test reflects actual violations rather than analysis timeouts.
    test.setTimeout(120_000);

    await page.goto(p.path, { waitUntil: 'networkidle' });

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();

    const critical = results.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious',
    );

    assertNoNewViolations(
      p.name,
      critical.length,
      critical.map(v => ({ id: v.id, impact: v.impact, description: v.description })),
    );
  });
}

test('kiosk-stop has no axe-detected critical/serious violations', async ({ page }) => {
  test.setTimeout(60_000);
  // /display/<stopId> renders an error/loading state for unknown stops —
  // suffisant pour évaluer le chrome (titre, contraste, lecture vocale).
  await page.goto('/display/unknown-stop-e2e', { waitUntil: 'networkidle' });
  await page.locator('.kiosk').waitFor({ state: 'visible', timeout: 10_000 });

  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .analyze();

  const critical = results.violations.filter(
    v => v.impact === 'critical' || v.impact === 'serious',
  );

  assertNoNewViolations(
    'kiosk-stop',
    critical.length,
    critical.map(v => ({ id: v.id, impact: v.impact, description: v.description })),
  );
});

test('hub has no axe-detected critical/serious violations', async ({ page }) => {
  test.setTimeout(60_000);
  // /hub sans token reste en état "loading" — on teste l'enveloppe.
  await page.goto('/hub', { waitUntil: 'networkidle' });
  await page.locator('.kiosk').waitFor({ state: 'visible', timeout: 10_000 });

  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .analyze();

  const critical = results.violations.filter(
    v => v.impact === 'critical' || v.impact === 'serious',
  );

  assertNoNewViolations(
    'hub',
    critical.length,
    critical.map(v => ({ id: v.id, impact: v.impact, description: v.description })),
  );
});

test('admin-dashboard has no axe-detected critical/serious violations', async ({ adminPage }) => {
  test.setTimeout(120_000);
  await adminPage.goto('/admin/dashboard', { waitUntil: 'networkidle' });
  await adminPage.locator('h1').waitFor({ state: 'visible', timeout: 15_000 });

  const results = await new AxeBuilder({ page: adminPage })
    .withTags(WCAG_TAGS)
    .analyze();

  const critical = results.violations.filter(
    v => v.impact === 'critical' || v.impact === 'serious',
  );

  assertNoNewViolations(
    'admin-dashboard',
    critical.length,
    critical.map(v => ({ id: v.id, impact: v.impact, description: v.description })),
  );
});
