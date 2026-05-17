# Contributing Guide

Thank you for your interest in contributing to Transit Display Hub.

## Code of Conduct

See [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## Local setup

### Requirements

- Node `>= 20` (pinned in `.nvmrc`)
- Java 21 (Temurin recommended — `sdk install java 21-tem`)
- Docker + Docker Compose (optional, only for Postgres / kiosk stack)
- A POSIX shell — Windows: use WSL2

### First-time setup

```bash
git clone https://github.com/Leigh-Chr/transit-display-hub.git
cd transit-display-hub

# Install Git hooks (commit-msg, pre-commit, pre-push)
npm install

# Backend requires JWT_SECRET to boot (fail-fast)
export JWT_SECRET=$(openssl rand -base64 48)

# Postgres via Docker (alternatively: install Postgres 17 locally)
docker compose up -d postgres

# Backend (port 8080)
(cd backend && ./gradlew bootRun)

# Frontend (port 4200) — second terminal
(cd frontend && npm install && npm start)
```

Open <http://localhost:4200>. Login `admin` / `admin123` — the backend
forces a password rotation on the first sign-in (Flyway V52), so pick a
new password of at least 12 characters when prompted.

## Quality gates (run automatically on hooks)

| Gate                                                              | Hook        | Command (manual)                            |
|-------------------------------------------------------------------|-------------|---------------------------------------------|
| Commit format (conventional commits)                              | commit-msg  | `npx commitlint --edit`                     |
| ESLint on staged TS / HTML                                        | pre-commit  | `cd frontend && npm run lint`               |
| Backend compile on staged Java                                    | pre-commit  | `cd backend && ./gradlew compileJava -q`    |
| File size guardrail                                               | pre-push    | `bash scripts/check-file-size.sh`           |
| Frontend lint + knip + tests                                      | pre-push    | `cd frontend && npm run lint && npm run knip && npm test` |
| Backend full check (test + jacoco + spotbugs + pmd + ArchUnit)    | pre-push    | `cd backend && ./gradlew check`             |
| Duplication scan                                                  | manual / CI | `npx jscpd`                                 |

Do **not** use `--no-verify` to skip hooks. If a hook fails, fix the
underlying issue.

## Submitting code

1. Fork the repository (or branch directly if you have push access).
2. Create a branch: `git checkout -b feat/my-feature`.
3. Make your changes — small focused commits, one logical change per
   commit.
4. Push and open a PR.

### Commit message format

Conventional commits (enforced by commitlint):

```
type(scope): short description in lowercase

Body (optional, wrap at 72 chars).
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`,
`test`, `chore`, `build`, `ci`.

Examples (from recent history):

- `refactor(kiosk): extract speak + effectiveTime to pure modules`
- `feat(shared): extract app-stop-autocomplete shared by pathways + fare-calculator`
- `chore(docker): switch backend to glibc + cap heap to 75 percent`

## Code standards

### Backend (Java 21, Spring Boot)

- **No Lombok** for new code — the project uses explicit
  getters/setters and JPA encapsulation (see `Stop.java`, `Itinerary.java`
  for the pattern). Existing Lombok usage will be migrated out over
  time.
- Records for DTOs, immutable where possible.
- Architecture is **hexagonal**: `domain` knows nothing of
  `application` or `infrastructure`; `api` knows nothing of `persistence`
  or `realtime`. **Enforced by ArchUnit** (`LayeredArchitectureTest`).
- `@Query` over derived names when the query has a JOIN or fetch hint.
- Tests with Testcontainers for repository tests touching real Postgres;
  H2 acceptable for unit-level `@DataJpaTest`.
- Use `@MockitoBean` (not deprecated `@MockBean`).

### Frontend (TypeScript strict, Angular 21)

- **Standalone components** only — no NgModules.
- `ChangeDetectionStrategy.OnPush` everywhere (currently 100 %).
- **Signals** for state, `effect` for side effects, `computed` for
  derivations.
- Prefer `rxResource` over manual `HttpClient.subscribe()` for data
  fetching.
- Never use `any` / `as any` / `@ts-ignore` — the codebase has **zero**
  occurrences.
- Avoid `OnInit` / `OnDestroy` in new code — use
  `constructor + effect + destroyRef.onDestroy(...)`.
- Tests with Vitest, Testing Library style assertions.

### Internationalisation

Every user-facing string must:

1. Live in `frontend/src/assets/i18n/en.json` (source of truth).
2. Have an equivalent in `frontend/src/assets/i18n/fr.json`
   (tutoiement).
3. Be referenced via the `transloco` pipe or `t()` function.

Adding a new language: drop a `<code>.json` file under `assets/i18n/`
and register it in `transloco.providers.ts`. See
[`docs/i18n.md`](docs/i18n.md) for translator-oriented guidance.

## Releasing

Releases are cut by tagging:

```bash
git tag -a v1.21.0 -m "Release v1.21.0"
git push origin v1.21.0
```

The `release.yml` workflow then:

1. Builds multi-arch (amd64 + arm64) backend + frontend images.
2. Publishes to `ghcr.io/leigh-chr/transit-display-hub-{backend,frontend}`.
3. Generates an SBOM (CycloneDX) and a Sigstore attestation.
4. Creates a GitHub Release with notes extracted from `CHANGELOG.md`.

Make sure `CHANGELOG.md` has the section for the new version **before**
tagging.

## Review process

1. CI must be green (`backend.yml`, `frontend.yml`, `e2e.yml`,
   `codeql.yml`, `dependency-check.yml`).
2. At least one maintainer review for non-trivial changes.
3. Resolve comments before merging.

## Questions

For questions, open an issue with the `question` label.
