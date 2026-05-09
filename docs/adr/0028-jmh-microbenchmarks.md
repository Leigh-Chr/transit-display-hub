# ADR 0028 — JMH micro-benchmarks for hot-path utilities, no full-stack benchmarks

**Status:** Accepted

## Context

Three classes sit on a path that runs many times per kiosk refresh:

- `ServiceCalendarMatcher.isActive` — called once per arrival per
  refresh (one per Schedule row in the 30-min window).
- `TranslationLookup.from` / `resolve` — built once per language
  change, queried once per arrival on multilingual feeds.
- `ColorContrast.readableTextColor` — called once per Line on import
  when `route_text_color` is missing, then on every line-badge render.

Today we have no number to anchor "fast enough" on these. A regression
would surface as a UI judder on big imports or a CPU spike on every
borne refresh, but only after a release.

Two flavours of benchmark were on the table:

1. **Micro-benchmarks** with [JMH] — measure individual methods in a
   warmed JVM, away from Spring, datasource, Hibernate. Fast (seconds
   per run), deterministic, easy to compare across commits. Limited
   to pure-compute code paths.

2. **Full-stack benchmarks** — boot Spring with an H2 fixture, run
   `DisplayStateCalculator.calculateForStop` or `NetworkMapService.compute`
   end-to-end through the real repositories. Closer to production
   shape, but runs minutes per benchmark and the variance from JVM /
   Hibernate / Spring caches makes commit-to-commit comparisons
   noisy.

[JMH]: https://openjdk.org/projects/code-tools/jmh/

## Decision

**Ship JMH micro-benchmarks for the three pure-compute utilities** and
defer the full-stack benchmark suite. The benchmarks live in
`backend/src/jmh/java/` (a dedicated source set provided by the
`me.champeau.jmh` Gradle plugin) and are run via `./gradlew jmh`.

The plugin gives us the source set, the `@Benchmark` annotation
processor wiring, and a sensible `JavaExec` task without us hand-rolling
classpath assembly.

```kotlin
plugins {
    id("me.champeau.jmh") version "0.7.2"
}

jmh {
    warmupIterations.set(2)
    iterations.set(3)
    fork.set(1)
    timeUnit.set("us")
    benchmarkMode.set(listOf("avgt"))
    resultFormat.set("JSON")
    resultsFile.set(file("build/reports/jmh/results.json"))
}
```

Default settings are tuned for a developer's "before-and-after" loop:
two warmup iterations, three measurement iterations, single fork,
average time in microseconds. A publishable measurement (numbers in
CHANGELOG, ADR comparisons) bumps the fork count to ≥ 2 manually with
`-Pjmh.fork=2`.

## Why three benchmarks, not one

Each utility tests a different cost shape:
- `ServiceCalendarMatcherBenchmark` parameterises by exception count
  (0 / 5 / 50) so the linear scan over `calendar_dates` exceptions
  shows up.
- `TranslationLookupBenchmark` parameterises by collection size
  (100 / 1k / 10k) so the build-the-map path scales separately from
  the constant-time resolve.
- `ColorContrastBenchmark` is single-shot: the input domain is small
  (every realistic hex string) and the cost is dominated by the
  parse + integer math.

## Consequences

- **Pre-refactor confidence on hot paths.** A developer touching
  `TranslationLookup` runs `./gradlew jmh -Pjmh.includes='TranslationLookup'`,
  reads the avgt before/after, and shows the delta in the PR — instead
  of guessing.
- **No CI gating.** The `jmh` task is not wired into `check` or any
  pre-merge step. Benchmarks are run on demand; reproducibility on
  busy CI machines is too unreliable to alert on regressions
  automatically.
- **Loss: no full-stack number today.** When a future ADR documents a
  refactor of `DisplayStateCalculator`, that ADR's "before / after"
  table can either accept the noise of a Spring-context run or build
  a second benchmark surface (probably under `src/jmh/java/...integration/`).
  Keeping both is healthy; trying to merge them into one is not.
- **Loss: no committed numbers as a baseline.** This ADR doesn't
  publish "isActive should run in < 1 µs". Pinning numerical
  acceptance criteria here would create a flaky correctness guarantee
  — a slower laptop CPU would falsely look like a regression. The
  benchmarks measure deltas, not absolutes.
- **Build cost.** The plugin pulls JMH 1.37 into the build classpath
  (~1.4 MB transitive). It does not affect runtime — the benchmarks
  are a source set, not a dependency of `main`.
