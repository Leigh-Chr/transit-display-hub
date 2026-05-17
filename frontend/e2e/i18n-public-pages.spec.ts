import { test, expect, Page } from '@playwright/test';

/**
 * Regression guard for the i18n fixes shipped in v1.4.2.
 *
 * Audit 2026-05-12 found that /login was the only public unauthenticated
 * route and yet shipped entirely hardcoded English — a French-resolved
 * user landed on the welcome screen and could not read it. The fix
 * wired Transloco on /login and /admin/data-overview-card; this spec
 * makes sure no future commit accidentally re-introduces a hardcoded
 * string on a public page.
 *
 * Strategy: visit each public page in both languages and assert on
 * page-specific anchor strings that are translated for each language.
 * If any future component lands with hardcoded English in the FR pass
 * (or hardcoded French in the EN pass), one of these checks fails.
 *
 * Anchors are page-specific because the public pages have no shared
 * chrome (no navbar with "Login"), so a single global anchor list
 * doesn't apply — see the original v1.4.2 design vs reality.
 */

interface PageAnchors {
  fr: string[];
  en: string[];
}

const PUBLIC_PAGES: ReadonlyArray<readonly [string, PageAnchors]> = [
  ['/login', {
    fr: ['Connexion', 'Identifiants', 'Mot de passe'],
    en: ['Login', 'Username', 'Password'],
  }],
  ['/map', {
    // The schematic page renders <h1>{{ 'map.networkMap' | transloco }}</h1>
    fr: ['Carte du réseau'],
    en: ['Network Map'],
  }],
  ['/map/list', {
    // The list view renders <h1>{{ t('map.title') }} — {{ t('map.viewList') }}</h1>
    fr: ['Plan du réseau'],
    en: ['Network map'],
  }],
  ['/not-found', {
    fr: ['Page introuvable'],
    en: ['Page not found'],
  }],
];

async function setLanguage(page: Page, lang: 'fr' | 'en'): Promise<void> {
  // LocaleService consults localStorage["lang"] before navigator.language,
  // so a one-time write is enough to pin the language for the visit.
  await page.context().addInitScript(
    `window.localStorage.setItem('lang', '${lang}');`,
  );
}

for (const [path, anchors] of PUBLIC_PAGES) {
  test(`${path} in fr-FR shows French strings and no English anchors`, async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await setLanguage(page, 'fr');
    await page.goto(path, { waitUntil: 'networkidle' });

    const body = page.locator('body');
    // At least one French anchor must render — proves Transloco resolved.
    let frHits = 0;
    for (const a of anchors.fr) {
      if (await body.getByText(a, { exact: false }).count() > 0) {
        frHits++;
      }
    }
    expect(frHits, `Expected at least one of ${anchors.fr.join(', ')} on ${path}`).toBeGreaterThan(0);

    // No English anchor on a French page — the regression we're guarding.
    for (const a of anchors.en) {
      await expect(
        body.getByText(a, { exact: true }),
        `English anchor "${a}" leaked into ${path} on the FR locale`,
      ).toHaveCount(0);
    }
    await context.close();
  });

  test(`${path} in en-US shows English strings and no French anchors`, async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await setLanguage(page, 'en');
    await page.goto(path, { waitUntil: 'networkidle' });

    const body = page.locator('body');
    let enHits = 0;
    for (const a of anchors.en) {
      if (await body.getByText(a, { exact: false }).count() > 0) {
        enHits++;
      }
    }
    expect(enHits, `Expected at least one of ${anchors.en.join(', ')} on ${path}`).toBeGreaterThan(0);

    for (const a of anchors.fr) {
      await expect(
        body.getByText(a, { exact: true }),
        `French anchor "${a}" leaked into ${path} on the EN locale`,
      ).toHaveCount(0);
    }
    await context.close();
  });
}

test('<html lang> attribute matches the active locale', async ({ browser }) => {
  // Regression for the constructor sync added in 18d1242: the attribute
  // used to stay on "en" until the user toggled the language switch,
  // which broke screen-reader voice selection for fr-resolved users.
  const context = await browser.newContext();
  const page = await context.newPage();
  await setLanguage(page, 'fr');
  await page.goto('/login', { waitUntil: 'networkidle' });
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await context.close();
});
