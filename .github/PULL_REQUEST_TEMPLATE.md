<!--
Thank you for opening a PR. The structure below mirrors the
ADR template — short, opinionated, no fluff.
-->

## Summary

<!--
One or two sentences describing what this PR does and why. Reference
the issue, ADR or milestone if applicable.
-->

## Changes

<!--
Bullet list of the substantive changes. Mention any:
  - new dependency
  - DB migration (Flyway version)
  - public API / endpoint change
  - i18n key added / removed
-->

-

## Testing

- [ ] Backend: `./gradlew check` (tests + JaCoCo)
- [ ] Frontend: `npm run lint && npm run test:coverage && npm run build`
- [ ] Knip clean: `npm run knip`
- [ ] Manual walk-through of the affected route(s)
- [ ] Screenshot / GIF attached for UX changes

## Checklist

- [ ] CHANGELOG.md updated under `[Unreleased]`
- [ ] ADR added if the change embodies a non-obvious decision
- [ ] Translations updated (`fr.json` + `en.json`) if new UI strings landed
- [ ] No new ESLint warnings or `knip` findings
