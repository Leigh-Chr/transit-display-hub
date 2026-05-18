import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test } from './fixtures/auth.fixture';

/**
 * Accessibility smoke tests (axe-core).
 *
 * Baseline established 2026-05-11, étendue 2026-05-16 aux pages
 * d'affichage public (kiosk / hub) et au dashboard admin, resserrée
 * 2026-05-18 après une mesure live des comptes effectifs (cf. le log
 * `[a11y] <name>: <count>` plus bas), puis migrée en per-rule allowlist
 * 2026-05-18 PM. Toute violation dont la rule axe n'est pas listée
 * dans {@link BASELINE} (même si le nombre total reste identique)
 * casse maintenant le build — pour qu'une régression NEW (nouveau type
 * de violation) ne passe plus inaperçue derrière un count constant.
 *
 * Baselines per-rule (rule axe → motif) :
 *   /map                → ['color-contrast'] (chip de légende résiduelle)
 *   /map/list           → ['color-contrast']
 *   /admin/lines        → ['color-contrast'] (chip de ligne)
 *   /admin/stops        → ['color-contrast']
 *   Toutes les autres pages → []
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

// Per-page allowlist: list every axe rule that is currently allowed to
// trip on this page. Empty array = no critical / serious violation is
// tolerated. The previous count-based budget would silently absorb a
// NEW rule failing as long as another residual rule had been fixed in
// the same release — the per-rule allowlist trips the build the moment
// a previously-unseen rule starts firing, even if the total count
// stays flat. Update the list when a residual is fixed (drop the rule)
// or when a new pre-existing residual is accepted (add it, with a
// reason in a comment).
const BASELINE: Record<string, string[]> = {
  login:             [],
  // The chip strip in the network legend pairs a pastel brand colour
  // with white text. Fixing this requires a brand-wide colour audit
  // that lives in a separate work stream.
  'network-map':     ['color-contrast'],
  'network-list':    ['color-contrast'],
  'kiosk-stop':      [],
  'hub':             [],
  'admin-dashboard': [],
  // Admin lines / stops embed the same line-chip pattern as the map.
  'admin-lines':     ['color-contrast'],
  'admin-stops':     ['color-contrast'],
  'admin-users':     [],
  'admin-messages':  [],
  'admin-schedules': [],
};

interface CriticalViolation {
  id: string;
  impact: string | null | undefined;
  description: string;
}

function assertNoNewViolations(name: string, criticals: CriticalViolation[]): void {
  const allowed = new Set(BASELINE[name] ?? []);
  const unexpected = criticals.filter(v => !allowed.has(v.id));
  // Surface the live picture on every run so a sustained drop motivates
  // tightening the allowlist. The soft expect below only logs the
  // unexpected violations when it fails, so without this line a page
  // that quietly stopped tripping its allowlisted rule would never
  // notify anyone — and the allowlist would stay loose.
  const seenRules = [...new Set(criticals.map(v => v.id))];
  const allowedRules = [...allowed];
  console.info(
    `[a11y] ${name}: ${criticals.length} critical/serious ` +
      `(rules seen: [${seenRules.join(', ') || 'none'}], ` +
      `allowlist: [${allowedRules.join(', ') || 'none'}])`,
  );
  expect.soft(
    unexpected,
    `${name}: ${unexpected.length} unexpected critical/serious violation(s) ` +
      `(not in allowlist [${allowedRules.join(', ') || 'none'}]):\n` +
      JSON.stringify(unexpected, null, 2),
  ).toEqual([]);
}

function toCriticalViolations(violations: { id: string; impact?: string | null; description: string }[]): CriticalViolation[] {
  return violations
    .filter(v => v.impact === 'critical' || v.impact === 'serious')
    .map(v => ({ id: v.id, impact: v.impact, description: v.description }));
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

    assertNoNewViolations(p.name, toCriticalViolations(results.violations));
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

  assertNoNewViolations('kiosk-stop', toCriticalViolations(results.violations));
});

test('hub has no axe-detected critical/serious violations', async ({ page }) => {
  test.setTimeout(60_000);
  // /hub sans token reste en état "loading" — on teste l'enveloppe.
  await page.goto('/hub', { waitUntil: 'networkidle' });
  await page.locator('.kiosk').waitFor({ state: 'visible', timeout: 10_000 });

  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .analyze();

  assertNoNewViolations('hub', toCriticalViolations(results.violations));
});

test('admin-dashboard has no axe-detected critical/serious violations', async ({ adminPage }) => {
  test.setTimeout(120_000);
  await adminPage.goto('/admin/dashboard', { waitUntil: 'networkidle' });
  await adminPage.locator('h1').waitFor({ state: 'visible', timeout: 15_000 });

  const results = await new AxeBuilder({ page: adminPage })
    .withTags(WCAG_TAGS)
    .analyze();

  assertNoNewViolations('admin-dashboard', toCriticalViolations(results.violations));
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

    assertNoNewViolations(p.name, toCriticalViolations(results.violations));
  });
}
