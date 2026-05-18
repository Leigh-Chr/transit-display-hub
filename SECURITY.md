# Security policy

## Reporting a vulnerability

Please **do not file a public issue** for security vulnerabilities.
Instead, use one of the private channels below so the maintainers
can prepare a fix before the details become widely known:

- **GitHub Security Advisories**:
  https://github.com/Leigh-Chr/transit-display-hub/security/advisories/new
- **Email**: open the discussion via a draft advisory on GitHub
  and the maintainer will respond within seven days.

When reporting, please include:

- A description of the issue and its potential impact.
- Reproduction steps or a proof-of-concept.
- The affected version (commit hash or release tag).
- Optional: a suggested fix or mitigation.

## Supported versions

The project follows semantic versioning. Security fixes land on
the latest minor release of the most recent major version. Older
minor releases receive fixes only for vulnerabilities flagged as
**critical** by the
[CVSS 4.0 calculator](https://www.first.org/cvss/calculator/4-0)
(score ≥ 9.0).

| Version | Supported           |
|---------|---------------------|
| 1.x     | :white_check_mark:  |
| < 1.0   | :x: (pre-stable)    |

## Disclosure timeline

- **Day 0**: report received.
- **Day 7**: acknowledgement sent, severity triaged.
- **Day 30**: fix shipped on `main` if severity ≥ medium.
- **Day 60**: public CVE / advisory published. Reporter
  credited unless they opt out.

## What this project considers in-scope

- The Spring Boot backend under `backend/`.
- The Angular frontend under `frontend/`.
- The `ops/kiosk/` deployment recipe.

## What is out of scope

- Third-party dependencies — please report directly to their
  maintainers (we forward when relevant).
- Self-built kiosks running customised code.
- Vulnerabilities requiring the attacker to already hold
  administrative credentials.

## Default admin credentials & rotation

The dev profile seeds `admin / admin123` for local quickstart and the
e2e suite. The flag `passwordMustChange = TRUE` (Flyway `V52`) forces
a rotation through `/auth/change-password` on first login.

The prod and kiosk profiles require an `INITIAL_ADMIN_PASSWORD`
environment variable at boot time (the same fail-closed pattern used
by `JWT_SECRET` and `DATABASE_PASSWORD`):

```bash
INITIAL_ADMIN_PASSWORD="$(openssl rand -base64 24)" \
JWT_SECRET="$(openssl rand -base64 48)" \
DATABASE_PASSWORD="..." \
java -jar transit-display-hub.jar --spring.profiles.active=prod
```

On first boot, `AdminPasswordBootstrap` replaces the seeded bcrypt
hash with the env-provided password and keeps `passwordMustChange = TRUE`,
so even an operator who picked a placeholder is still routed through
the rotation screen on first login.
