# ADR 0039 — Cookie-based authentication with refresh token rotation

**Status:** Accepted (2026-05-11, shipped in v1.4.0)

## Context

Until v1.3.0 the only way for the browser SPA to authenticate was the
classic Bearer JWT flow: `POST /api/auth/login` returned an access
token in the JSON body, the Angular app stored it in `localStorage`,
and the interceptor copied it into an `Authorization: Bearer …` header
on every API call. Two consequences of that design surfaced in the
2026-05-10 audit:

1. **Tokens reachable by JavaScript.** Any DOM-XSS payload that
   reaches the page can read `localStorage` and exfiltrate the JWT.
   Once exfiltrated, the token is replayable until its 8-hour
   expiration runs out — there is no server-side revocation handle.
2. **No rotation, no logout-server-side.** A "logout" only cleared
   the local copy. If the token had been copied elsewhere, that copy
   stayed valid until natural expiration.

Swagger UI on the other hand depends on Bearer headers (its
"Authorize" button speaks that protocol), and the kiosk WebSocket
layer needs a JWT it can send in the STOMP `CONNECT` frame (browsers
do not auto-attach cookies to STOMP frames). A simple "switch
everything to cookies" therefore breaks two upstream consumers.

## Decision

Adopt a **dual-track auth** layout that keeps both transport modes
alive during the migration window, plus a **rotating refresh token**
mechanism that gives operators a server-side revocation handle.

### Server side

- `POST /api/auth/login` keeps its JSON body for backwards
  compatibility with Swagger UI and any CLI consumer, **and** drops
  two `Set-Cookie` headers:
  - `ACCESS_TOKEN` — `HttpOnly`, `Secure` (configurable),
    `SameSite=Strict`, path `/`. Carries the same JWT the body
    returns, with a short TTL aligned on `app.jwt.expiration-hours`.
  - `REFRESH_TOKEN` — same flags, path `/api/auth`. Carries a
    256-bit opaque token; the server only persists its SHA-256
    digest in `refresh_tokens` (migration `V50`).
- `POST /api/auth/refresh` consumes the refresh cookie, rotates it
  (revokes the previous row, mints a successor, walks
  `replaced_by_id` so reuse of an already-rotated token can be
  detected and burns the active chain), then mints a fresh access
  token in cookie + body.
- `POST /api/auth/logout` revokes the refresh row server-side and
  ships two clearing `Set-Cookie` headers.
- `GET /api/auth/me` returns `{ username, role }` reconstructed from
  the `SecurityContext`. Lets the SPA reconstruct identity after a
  reload when the JWT lives only in an `HttpOnly` cookie.
- `JwtAuthenticationFilter` reads `Authorization: Bearer …` first
  (legacy + Swagger + STOMP) and falls back to the `ACCESS_TOKEN`
  cookie when no Bearer header is present.
- Spring Security CSRF is **re-enabled** using
  `CookieCsrfTokenRepository.withHttpOnlyFalse()` so Angular can
  copy the `XSRF-TOKEN` cookie into `X-XSRF-TOKEN`. A custom
  `RequestMatcher` exempts:
  - Bearer-bearing callers — browsers never auto-attach that header,
    so they cannot be tricked into a cross-site replay.
  - `/api/auth/**` — login has no XSRF cookie yet, refresh + logout
    are already gated by their own refresh-token cookie.

### Client side

- The Angular SPA drops `localStorage` and `jwt-decode`. Identity is
  reconstructed from `/api/auth/me`, called once at boot via
  `provideAppInitializer`. The JWT body received from `/login` and
  `/refresh` lives in an in-memory signal — **never persisted** —
  exclusively to hydrate the STOMP `CONNECT` Bearer header.
- The HTTP interceptor sets `withCredentials: true` on every request
  and, on a 401 outside `/api/auth/**`, runs a single in-flight
  `/refresh` call before retrying the original request. A second
  failure logs the user out.
- `withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName:
  'X-XSRF-TOKEN' })` is wired in `provideHttpClient` so Angular
  mirrors the XSRF cookie into the mutating-request header
  automatically.

### Configuration surface

`app.auth` and `app.jwt` are exposed as typed
`@ConfigurationProperties` records (`AuthProperties`,
`JwtProperties`) in v1.4.1 — a single point of validation with
`@NotBlank` on the JWT secret that crashes the boot if it is
missing.

| Key                                | Default                   | Notes                                              |
| ---------------------------------- | ------------------------- | -------------------------------------------------- |
| `app.jwt.secret`                   | dev fallback only          | ≥ 32 bytes ; mandatory in prod / kiosk             |
| `app.jwt.expiration-hours`         | `8`                        | access token TTL                                   |
| `app.jwt.refresh-expiration-days`  | `14`                       | refresh token TTL                                  |
| `app.jwt.issuer` / `audience`      | `transit-display-hub` ...  | mandatory iss / aud claims since v1.2.0            |
| `app.auth.access-cookie-name`      | `ACCESS_TOKEN`             | match the value in any reverse-proxy ACL           |
| `app.auth.refresh-cookie-name`     | `REFRESH_TOKEN`            | scoped to `/api/auth`                              |
| `app.auth.cookie-secure`           | `false` (dev) / `true` ... | **must** be `true` behind HTTPS                    |
| `app.auth.cookie-same-site`        | `Strict`                   | `Strict` blocks cross-site form posts entirely     |
| `app.auth.cookie-domain`           | empty                      | leave empty unless you serve multi-host (not the case in this project) |

## Why not "cookies only"?

Three callers need a Bearer header on the wire and would have to be
reworked to live with cookies only:

- **Swagger UI** drives "Try it out" with `Authorization: Bearer …`.
  Stripping Bearer support means losing the ability to exercise the
  API from the bundled docs — a significant DX regression.
- **CLI / curl integrators** that follow the public API doc.
- **STOMP CONNECT** frames over WebSocket. Browsers attach cookies
  to the upgrade request but not to subsequent STOMP frames; the
  backend `ChannelInterceptor` already reads the `Authorization`
  header from the CONNECT frame and we did not want to introduce a
  cookie-aware path through the WS broker just to chase a marginal
  attack surface.

The matcher-based CSRF exemption above is what makes the dual track
safe: Bearer callers are *out of band* of the cookie session and
cannot be CSRF-tricked.

## Trade-offs accepted

- **Two persisted things instead of one.** The refresh tokens table
  is now load-bearing. A long-lived deployment will accumulate rows;
  the service exposes `purgeExpired()` which is safe to run on a
  cron — wiring it to a scheduled job is left for a future
  follow-up if table size becomes a real problem.
- **Reuse detection is binary.** If a refresh token is replayed, we
  burn the user's entire active set, not just the offending session.
  This is the conservative choice — a stolen token cannot be
  distinguished from a network retry without correlating fingerprints
  we are not collecting.
- **Migration window cost.** Two endpoints (`/refresh`, `/logout`)
  and one filter branch exist *only* to bridge the legacy Bearer
  flow with the new cookie flow. Dropping Bearer once the cookie
  flow has been stable for one major version is the natural
  follow-up; the matcher would then collapse to the default Spring
  rule.

## What this supersedes

- Implicit "Bearer + `localStorage`" agreement that lived in
  `auth.service.ts` from v1.0.0 through v1.3.0.
- The "CSRF disabled, we're stateless" line in `SecurityConfig`,
  which was true for Bearer-only but no longer applies once
  browsers ship cookies on the user's behalf.
