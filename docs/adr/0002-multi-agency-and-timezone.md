# ADR 0002 — Multi-agency model and timezone resolution chain

**Status:** Accepted

## Context

`DisplayStateCalculator` compares wall-clock schedule times against
`LocalTime.now(zone)` to decide which arrivals fall within the
30-minute display window. The `zone` used to come from a single
`app.timezone` property defaulted to `Europe/Paris`.

Two real failure modes followed:

1. **JVM in UTC, operator in CET.** Without an explicit override, the
   server picked up `Europe/Paris` from the property — a silent and
   correct default for French feeds, but every feed outside that
   timezone needed an env var. Easy to miss on Docker images.
2. **Multi-agency feeds.** GTFS `agency.txt` may declare more than one
   agency (operator + concessionnaire is common in France). Each row
   carries its own `agency_timezone`. Folding them all under a single
   property would fix some kiosks while breaking others.

## Decision

**Persist `agency.txt` as a first-class entity.** A new `Agency` table
holds id, externalId (GTFS `agency_id`), name, url, timezone, lang,
phone, fareUrl, email. `Line.agency_id` becomes a nullable foreign key.

**Routes resolve their agency by `agency_id`** with a fallback to "the
single agency this feed declares" when the route omits the field — the
GTFS spec permits that shortcut for single-agency feeds.

**The display-state calculator resolves the operating zone by chaining
four sources, in order:**

1. The stop's own `stop_timezone` (rare but valid; respected first so
   transit networks crossing zones do the right thing).
2. The `agency.timezone` of the most-served line at the stop (most
   served = highest line count among the stop's lines, ties broken by
   line code so the choice is deterministic).
3. The first non-blank `agency.timezone` encountered.
4. The `app.timezone` property — the global fallback for installs whose
   feed has no `agency.txt`.

Invalid timezone strings (legacy entries, typos) silently fall through
to the next step. We never throw; a malformed agency row should not
take a kiosk offline.

## Consequences

**Existing installs.** Old rows have `agency_id = NULL`; the resolver
falls through to step 4 (the `app.timezone` property), preserving the
previous behaviour exactly.

**Multi-agency feeds.** Every line gets the correct zone. The
"most-served line" tiebreaker is stable across imports because line
codes survive re-imports.

**Performance.** The resolver walks the stop's lines once per
display-state computation; a stop typically has 1–5 lines. Negligible.

## Alternatives rejected

- **Lazily detect a single timezone per import and stash it on
  `FeedInfo`.** Doesn't work for multi-zone feeds, and doesn't work
  before the first GTFS import has run.
- **Drop `app.timezone` entirely once `Agency` exists.** Keeps a
  reasonable fallback for any deployment whose feed lacks `agency.txt`
  or whose first import has not completed yet.
