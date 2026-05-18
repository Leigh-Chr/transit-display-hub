import { test, expect } from './fixtures/auth.fixture';
import { waitForAnimationsToSettle } from './fixtures/wait-for-stable';
import * as path from 'node:path';

/**
 * Capture les 6 PNG embarqués dans le README. Skippé par défaut pour
 * ne pas overrider les screenshots durant les runs CI / locaux normaux.
 * Lancement explicite :
 *
 * ```
 * SCREENSHOTS_ENABLED=1 npx playwright test screenshots.spec.ts --project=chromium
 * ```
 *
 * Pré-requis :
 *   - backend lancé avec `SPRING_PROFILES_ACTIVE=dev`,
 *     `DATA_LOADER_GTFS_URL=classpath:fixtures/gtfs-rich/`,
 *     `JWT_SECRET=...` (≥ 32 chars).
 *   - frontend lancé par Playwright (webServer config) sur :4200.
 */

const OUTPUT_DIR = path.resolve(__dirname, '..', '..', 'docs', 'screenshots');

const enabled = process.env.SCREENSHOTS_ENABLED === '1';

test.beforeEach(({}, testInfo) => {
  testInfo.setTimeout(60_000);
  test.skip(!enabled, 'Set SCREENSHOTS_ENABLED=1 to regenerate README screenshots');
});

test.use({ viewport: { width: 1440, height: 900 } });

test('capture admin-dashboard.png', async ({ adminPage }) => {
  await adminPage.goto('/admin/dashboard', { waitUntil: 'networkidle' });
  await adminPage.locator('h1').first().waitFor({ state: 'visible' });
  await waitForAnimationsToSettle(adminPage);
  await adminPage.screenshot({
    path: path.join(OUTPUT_DIR, 'admin-dashboard.png'),
    fullPage: true,
  });
});

test('capture network-map.png', async ({ page }) => {
  await page.goto('/map', { waitUntil: 'networkidle' });
  // Le composant bascule auto entre schematic (≤ N lignes) et line-index.
  // Les deux constituent un rendu valide pour le README.
  const schematic = page.locator('app-schematic-map svg').first();
  const lineIndex = page.locator('app-line-index').first();
  await schematic.or(lineIndex).waitFor({ state: 'visible', timeout: 15_000 });
  await waitForAnimationsToSettle(page);
  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'network-map.png'),
    fullPage: false,
  });
});

test('capture stop-popup.png', async ({ page, request }) => {
  // Pour garantir un schematic riche en stops, on isole la ligne avec le
  // plus de schedules au lieu de cliquer la première puce du line-index
  // (qui peut tomber sur une ligne scolaire sparse comme `0E33608` sans
  // aucun stop affichable au render). `scheduleCount` côté payload est
  // l'agrégat itinerary × stop × service calendar — il pique au plus haut
  // les lignes vraiment denses (CHRONO/PROXIMO/tram).
  const resp = await request.get('http://localhost:8080/api/network-map');
  const { lines } = await resp.json() as {
    lines: { code: string; scheduleCount?: number }[];
  };
  const densest = [...lines].sort(
    (a, b) => (b.scheduleCount ?? 0) - (a.scheduleCount ?? 0),
  )[0];
  if (!densest) {
    throw new Error('No lines available in seed — cannot capture stop-popup');
  }
  await page.goto(`/map?lines=${encodeURIComponent(densest.code)}`, { waitUntil: 'networkidle' });
  await page.locator('app-schematic-map svg').first().waitFor({ state: 'visible', timeout: 15_000 });
  await waitForAnimationsToSettle(page);
  // Le markup réel : groupes SVG `.stop-group` portant `(click)="onStopClick(...)"`.
  // On vise un stop visible (pas dimmed) pour un popup propre.
  const stop = page.locator('.stop-group:not(.route-dimmed):not(.access-dimmed):not(.zone-dimmed)').first();
  await stop.waitFor({ state: 'visible', timeout: 10_000 });
  await stop.click({ force: true });
  await page.locator('mat-dialog-container, .stop-popup').first().waitFor({ state: 'visible', timeout: 5_000 });
  await waitForAnimationsToSettle(page);
  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'stop-popup.png'),
    fullPage: false,
  });
});

test('capture kiosk.png', async ({ page, request }) => {
  // Les stopId côté API sont des UUIDs régénérés à chaque seed —
  // on les résout au runtime via /api/network-map, puis on cherche le
  // premier stop qui retourne au moins une arrivée pour éviter un
  // screenshot vide. Si aucun n'a d'arrivées (typique tard le soir), on
  // retombe sur le premier stop pour garder un rendu cohérent du chrome.
  const resp = await request.get('http://localhost:8080/api/network-map');
  const networkMap = await resp.json() as { stops: { id: string; name: string }[] };
  let chosen = networkMap.stops[0];
  for (const s of networkMap.stops.slice(0, 60)) {
    const r = await request.get(`http://localhost:8080/api/displays/stop/${s.id}`);
    if (!r.ok()) {continue;}
    const body = await r.json() as { arrivals?: unknown[] };
    if (Array.isArray(body.arrivals) && body.arrivals.length > 0) {
      chosen = s;
      break;
    }
  }
  if (!chosen) {
    throw new Error('No stops available in seed — cannot capture kiosk');
  }
  await page.goto(`/display/${chosen.id}`, { waitUntil: 'networkidle' });
  await page.locator('.kiosk').waitFor({ state: 'visible', timeout: 15_000 });
  // The kiosk ticker scroll is intentionally infinite; the helper
  // ignores it and returns when the entry transitions settle.
  await waitForAnimationsToSettle(page);
  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'kiosk.png'),
    fullPage: false,
  });
});

test('capture import-audit.png', async ({ adminPage }) => {
  await adminPage.goto('/admin/import-audit', { waitUntil: 'networkidle' });
  await adminPage.locator('h1').first().waitFor({ state: 'visible' });
  await waitForAnimationsToSettle(adminPage);
  await adminPage.screenshot({
    path: path.join(OUTPUT_DIR, 'import-audit.png'),
    fullPage: false,
  });
});

test('capture network-list.png', async ({ page }) => {
  await page.goto('/map/list', { waitUntil: 'networkidle' });
  await page.locator('h1, .page-title').first().waitFor({ state: 'visible', timeout: 15_000 });
  await waitForAnimationsToSettle(page);
  // Viewport-only — un fullPage produirait un PNG de ~40 000 px de haut
  // sur les feeds réels (2500+ arrêts), inexploitable dans un README.
  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'network-list.png'),
    fullPage: false,
  });
});

// Sentinel — vérifie que les 6 PNG existent et ne sont pas vides après
// l'exécution. Permet de détecter immédiatement un sélecteur qui aurait
// échoué sans cracher.
test('verify all screenshots produced', async () => {
  const fs = await import('node:fs/promises');
  const expected = [
    'admin-dashboard.png',
    'network-map.png',
    'stop-popup.png',
    'kiosk.png',
    'import-audit.png',
    'network-list.png',
  ];
  for (const f of expected) {
    const p = path.join(OUTPUT_DIR, f);
    const stat = await fs.stat(p);
    expect.soft(stat.size, `${f}: empty file`).toBeGreaterThan(1_000);
  }
});
