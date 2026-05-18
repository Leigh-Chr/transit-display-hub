import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test } from './fixtures/auth.fixture';

/**
 * Accessibility smoke tests (axe-core).
 *
 * Baseline established 2026-05-11, étendue 2026-05-16 aux pages
 * d'affichage public (kiosk / hub) et au dashboard admin, resserrée
 * 2026-05-18 après une mesure live des comptes effectifs (cf. le log
 * `[a11y] <name>: <count>` plus bas). Les violations pré-existantes
 * sont épinglées en soft assertion : toute violation critique/sérieuse
 * NOUVELLE au-dessus de la baseline cassera la CI, mais les anciennes
 * ne bloquent pas le merge.
 *
 * Baselines (après resserrement 2026-05-18) :
 *   /login              → 0 (déjà 0 depuis l'origine)
 *   /map                → 1 (résiduel : contraste d'une chip de légende)
 *   /map/list           → 1 (idem sur la liste)
 *   /display/<stopId>   → 0 (le loading/error chrome est propre)
 *   /hub                → 0 (idem hub sans token)
 *   /admin/dashboard    → 0 (post-v1.25.0 design tokens : 0 violation)
 *   /admin/lines        → 1 (résiduel chip ligne)
 *   /admin/stops        → 1 (résiduel chip ligne sur les arrêts)
 *   /admin/{users,messages,schedules} → 0
 */

const publicPages = [
  { path: '/login',     name: 'login' },
  { path: '/map',       name: 'network-map' },
  { path: '/map/list',  name: 'network-list' },
];

// Admin pages added 2026-05-18 — the audit flagged that 15+ admin views
// were unaudited, so any contrast regression caught by the dashboard
// baseline would slip silently through the rest. We start with a wide
// per-page budget (the dashboards share their card / chip components so
// the baseline counts mirror it closely) and ratchet down as fixes land.
const adminPages = [
  { path: '/admin/lines',     name: 'admin-lines' },
  { path: '/admin/stops',     name: 'admin-stops' },
  { path: '/admin/users',     name: 'admin-users' },
  { path: '/admin/messages',  name: 'admin-messages' },
  { path: '/admin/schedules', name: 'admin-schedules' },
];

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Per-page baseline: update when a pre-existing violation is fixed.
// The residual contrast findings on the network pages come from
// secondary line-chip / legend pairs that do not affect readability
// of stop or line names. Three CI runs in a row converged on the
// numbers below (the `[a11y] …` log captures each); a real regression
// (a new violation on top of these) still trips CI.
const BASELINE: Record<string, number> = {
  login:             0,
  'network-map':     1,
  'network-list':    1,
  'kiosk-stop':      0,
  'hub':             0,
  'admin-dashboard': 0,
  // Admin pages share the dashboard's chip / card system; the
  // post-v1.25.0 design-token migration dropped most violations to 0.
  // The two pages still at 1 carry a line-chip on the row template.
  'admin-lines':     1,
  'admin-stops':     1,
  'admin-users':     0,
  'admin-messages':  0,
  'admin-schedules': 0,
};

function assertNoNewViolations(name: string, criticalCount: number, sample: unknown): void {
  // Surface the live count on every run so a sustained drop motivates a
  // baseline tighten. The soft expect below only logs the count when it
  // fails, so without this line a page that quietly improved from 5 → 1
  // violations would never tell anyone — and the budget would stay loose.
  console.info(`[a11y] ${name}: ${criticalCount} critical/serious (baseline ${BASELINE[name] ?? 0})`);
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

for (const p of adminPages) {
  test(`${p.name} has no axe-detected critical/serious violations`, async ({ adminPage }) => {
    test.setTimeout(120_000);
    await adminPage.goto(p.path, { waitUntil: 'networkidle' });
    // Page chrome may be slow to render the first time (tables hydrate
    // from rxResource async) — wait for h1 just like the dashboard test.
    await adminPage.locator('h1').waitFor({ state: 'visible', timeout: 15_000 });

    const results = await new AxeBuilder({ page: adminPage })
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
