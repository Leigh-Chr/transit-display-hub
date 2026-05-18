import type { Page } from '@playwright/test';

/**
 * Wait until every CSS / Web Animations API animation on the page has
 * either finished or is marked as infinite (spinners, ticker scroll,
 * pulse) so a screenshot captures the post-transition pixels, not a
 * frame mid-fade. Resolves immediately when no animation is queued at
 * all.
 *
 * Prefer this over {@link Page.waitForTimeout} for screenshot captures
 * — it is bounded by the actual paint rather than a hand-tuned guess,
 * and never delays a fast run for no reason.
 */
export async function waitForAnimationsToSettle(
  page: Page,
  timeoutMs = 3_000,
): Promise<void> {
  await page.waitForFunction(
    () =>
      document.getAnimations().every((a) => {
        const settled =
          a.playState === 'finished' || a.playState === 'idle';
        const infinite =
          a.effect !== null &&
          'getTiming' in a.effect &&
          a.effect.getTiming().iterations === Infinity;
        return settled || infinite;
      }),
    null,
    { timeout: timeoutMs },
  );
}
