plugins {
    java
    jacoco
    pmd
    id("org.springframework.boot") version "4.0.2"
    id("io.spring.dependency-management") version "1.1.7"
    id("com.google.protobuf") version "0.9.5"
    // Static analysis. SpotBugs catches bytecode-level bugs (NPE,
    // EI_EXPOSE_REP, default-encoding traps); PMD covers style and
    // best-practice patterns. Both gate `check` so a regression
    // surfaces in CI rather than at review time.
    id("com.github.spotbugs") version "6.0.26"
    // Lists outdated dependencies — manual `./gradlew dependencyUpdates`,
    // not part of `check` (informational, not a gate).
    id("com.github.ben-manes.versions") version "0.52.0"
    // OWASP dependency-check. Runs out-of-band (`./gradlew dependencyCheckAnalyze`)
    // because the first NVD download takes minutes and a CI cache must
    // be primed; the actual gating is in a dedicated workflow.
    id("org.owasp.dependencycheck") version "11.1.1"
    // Official JMH plugin — provides the `jmh` source set, the
    // {@code jmh} verification task, annotation-processor wiring for
    // the @Benchmark indexer, and a sensible default fork / warmup
    // configuration. Out-of-band of the standard test task so a JMH
    // run stays explicit (`./gradlew jmh`) and never blocks CI.
    id("me.champeau.jmh") version "0.7.2"
}

group = "com.transit"
version = "1.5.1"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

configurations {
    compileOnly {
        extendsFrom(configurations.annotationProcessor.get())
    }
    // JMH micros use Spring Data repositories (stubbed via Mockito) and
    // domain types from main, so we extend the regular implementation
    // classpath rather than copy-pasting dependency lines.
    named("jmhImplementation") {
        extendsFrom(configurations.implementation.get())
    }
    named("jmhAnnotationProcessor") {
        extendsFrom(configurations.annotationProcessor.get())
    }
}

repositories {
    mavenCentral()
}

dependencies {
    // Rate limiting (login endpoint)
    implementation("com.bucket4j:bucket4j-core:8.10.1")

    // Spring Boot Starters
    implementation("org.springframework.boot:spring-boot-starter-webmvc")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-websocket")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-cache")
    implementation("com.github.ben-manes.caffeine:caffeine")

    // Prometheus scrape format on /actuator/prometheus. Spring Boot
    // wires the registry into Micrometer automatically when this
    // dependency is on the classpath (no additional Java config).
    runtimeOnly("io.micrometer:micrometer-registry-prometheus")

    // JWT
    implementation("io.jsonwebtoken:jjwt-api:0.13.0")
    runtimeOnly("io.jsonwebtoken:jjwt-impl:0.13.0")
    runtimeOnly("io.jsonwebtoken:jjwt-jackson:0.13.0")

    // GTFS import (CSV parsing)
    implementation("org.apache.commons:commons-csv:1.12.0")

    // OpenAPI / Swagger UI — exposes /swagger-ui.html and /v3/api-docs
    // for admins and frontend devs. Keeps the bundled Swagger UI rather
    // than hosting an external one so the docs travel with the binary.
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.6")

    // GTFS-Realtime — Protobuf bindings generated from the official
    // gtfs-realtime.proto file in src/main/proto/. Used by the
    // ServiceAlerts cache to surface operator-pushed alerts on
    // kiosks and hubs.
    implementation("com.google.protobuf:protobuf-java:3.25.6")

    // Canonical MobilityData GTFS Schedule validator (Apache 2.0). The
    // import-audit page invokes it after each GTFS import so an
    // operator can see the same warnings/errors the global validator
    // would surface — without having to upload the feed elsewhere.
    // The {@code -main} artefact ships the runner; {@code -core} the
    // shared types ({@code CountryCode}, notice model). Their pom
    // declares the transitive link as {@code runtime} so we have to
    // restate {@code -core} on the implementation classpath for the
    // service code to compile against {@code CountryCode}.
    // Pulls Guava 31 + Gson 2.8 + Apache HttpClient 5 transitively;
    // we accept the runtime overlap with Spring Boot's Jackson stack
    // because the validator owns its own JSON output format.
    implementation("org.mobilitydata.gtfs-validator:gtfs-validator-main:8.0.0")
    implementation("org.mobilitydata.gtfs-validator:gtfs-validator-core:8.0.0")

    // Pin commons-compress ahead of the gtfs-validator transitive (1.20),
    // which carries four DoS CVEs reachable from POST /api/admin/gtfs/reimport
    // (CVE-2021-35515/-35516/-35517/-36090).
    implementation("org.apache.commons:commons-compress:1.27.1")

    // gtfs-validator also drags in commons-beanutils 1.9.2 (CVE-2025-48734
    // RCE via crafted properties) and commons-validator 1.6 (various
    // out-of-scope CVEs). Pin both ahead so the runtime classpath uses
    // current patched releases.
    implementation("commons-beanutils:commons-beanutils:1.11.0")
    implementation("commons-validator:commons-validator:1.10.0")

    // Database. Versions pinned ahead of the Spring Boot BOM defaults to
    // pull in the latest patch releases (CVE bumps, JDBC fixes).
    runtimeOnly("com.h2database:h2")
    runtimeOnly("org.postgresql:postgresql:42.7.11")

    // Flyway
    implementation("org.springframework.boot:spring-boot-starter-flyway")
    implementation("org.flywaydb:flyway-database-postgresql")

    // Lombok — pinned ahead of the Spring Boot BOM to take in the latest
    // bytecode-compat fixes for JDK 21+ records.
    compileOnly("org.projectlombok:lombok:1.18.46")
    annotationProcessor("org.projectlombok:lombok:1.18.46")

    // DevTools
    developmentOnly("org.springframework.boot:spring-boot-devtools")

    // Testing
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
    testImplementation("org.springframework.boot:spring-boot-data-jpa-test")
    testImplementation("org.springframework.security:spring-security-test")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")

    // ArchUnit — enforces layered architecture at test time. The
    // LayeredArchitectureTest pins the package boundaries so a
    // refactor that reintroduces an infrastructure import inside
    // a domain class fails ./gradlew check rather than silently
    // landing on main.
    testImplementation("com.tngtech.archunit:archunit-junit5:1.3.0")

    // JMH-only — Mockito lets micro-benchmarks stub the Spring Data
    // repositories with constant-time fakes so the measurement stays
    // focused on the service code (not the JPA round-trip).
    "jmhImplementation"("org.mockito:mockito-core:5.14.2")
}

// Protobuf code generation for gtfs-realtime.proto. The plugin
// downloads the protoc binary from Maven Central as a Maven artefact;
// no system-wide protoc install required.
//
// Known issue: the protobuf-gradle-plugin (0.9.5) builds the protoc
// dependency internally with the multi-string Map notation
// `(group, name, version, classifier, ext)` so it can append the
// platform-specific classifier ("linux-x86_64@exe", "osx-aarch_64@exe",
// …). Gradle 9 deprecated that notation and Gradle 10 will reject it.
// Tracking https://github.com/google/protobuf-gradle-plugin/issues/762
// upstream — nothing we can do from this build script.
springBoot {
    buildInfo()
}

protobuf {
    protoc {
        artifact = "com.google.protobuf:protoc:3.25.6"
    }
}

tasks.withType<Test> {
    useJUnitPlatform {
        // Real-network smoke tests against published GTFS feeds (Bordeaux,
        // Strasbourg, Tours…) are tagged "real-feed" and skipped here so
        // the default ./gradlew test stays Internet-free. Run them with
        // ./gradlew testRealFeed (see below) when validating layout-engine
        // generality against new feed shapes.
        excludeTags("real-feed")
    }
}

/**
 * Opt-in test task for the @Tag("real-feed") suite. Hits the public
 * GTFS endpoints so it requires Internet and is naturally skipped in CI.
 * Each individual test still gates on a system property so it self-skips
 * when the upstream is down — see RealGtfsFeedIntegrationTest.
 */
tasks.register<Test>("testRealFeed") {
    useJUnitPlatform {
        includeTags("real-feed")
    }
    description = "Runs the GTFS importer against real public feeds. " +
            "Requires Internet; skipped from the default test task."
    group = "verification"
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    shouldRunAfter("test")
}

tasks.withType<JavaCompile> {
    options.compilerArgs.add("-Xlint:deprecation")
}

// JaCoCo wires automatically into the `test` task; `jacocoTestReport`
// then writes both an HTML and an XML report under
// build/reports/jacoco/. We require ./gradlew check to run the report
// after tests so a CI pipeline gets coverage data without a second
// command. The minimum coverage threshold is intentionally modest —
// the goal is to detect a regression below the current baseline, not
// to block merges on every uncovered branch.
tasks.named<JacocoReport>("jacocoTestReport") {
    dependsOn(tasks.named("test"))
    reports {
        html.required.set(true)
        xml.required.set(true)
    }
    // JMH benchmark sources live outside the `test` source set so they
    // shouldn't count against coverage; the default classDirectories
    // already excludes them. We keep generated protobuf code out too —
    // mechanical Java the validator never lands on.
    classDirectories.setFrom(
        files(classDirectories.files.map {
            fileTree(it) {
                exclude("com/google/transit/realtime/**")
            }
        })
    )
}

tasks.named("check") {
    dependsOn(tasks.named("jacocoTestReport"))
    dependsOn(tasks.named("jacocoTestCoverageVerification"))
    dependsOn(tasks.named("spotbugsMain"))
    dependsOn(tasks.named("pmdMain"))
}

spotbugs {
    ignoreFailures.set(false)
    effort.set(com.github.spotbugs.snom.Effort.MORE)
    reportLevel.set(com.github.spotbugs.snom.Confidence.MEDIUM)
    excludeFilter.set(file("config/spotbugs/exclude.xml"))
}

tasks.withType<com.github.spotbugs.snom.SpotBugsTask>().configureEach {
    reports.create("html") { required.set(true) }
    reports.create("xml") { required.set(true) }
}

// SpotBugs / PMD on test code is too noisy to be useful (mocks, builders,
// throw-away helpers). Skip the test source set; keep main analysed.
tasks.named("spotbugsTest") { enabled = false }
tasks.named("pmdTest") { enabled = false }
tasks.named("spotbugsJmh") { enabled = false }
tasks.named("pmdJmh") { enabled = false }

pmd {
    isIgnoreFailures = false
    toolVersion = "7.7.0"
    ruleSetConfig = resources.text.fromFile("config/pmd/ruleset.xml")
    // The ruleset config is the source of truth — ruleSets must be empty
    // so PMD doesn't merge in its built-in defaults.
    ruleSets = listOf()
    isConsoleOutput = false
}

tasks.withType<Pmd>().configureEach {
    reports {
        html.required.set(true)
        xml.required.set(true)
    }
    exclude("com/google/transit/realtime/**")
}

dependencyCheck {
    failBuildOnCVSS = 7.0f
    formats = listOf("HTML", "JSON", "SARIF")
    nvd.apiKey = System.getenv("NVD_API_KEY") ?: ""
    analyzers.assemblyEnabled = false
}

tasks.named<JacocoCoverageVerification>("jacocoTestCoverageVerification") {
    dependsOn(tasks.named("test"))
    // Same protobuf exclusion as the report so the bundle ratio reflects
    // hand-written code, not the 19k LoC GtfsRealtime.java the validator
    // never lands on.
    classDirectories.setFrom(
        files(classDirectories.files.map {
            fileTree(it) {
                exclude("com/google/transit/realtime/**")
            }
        })
    )
    violationRules {
        rule {
            element = "BUNDLE"
            // Instruction coverage gate — the headline number we shipped
            // with v1.0.0. Tightening it without first plugging the gaps
            // surfaced in audit 2026-05-12 (Fare/Flex/DeviceHeartbeat at
            // 0 %) would mean ratcheting CI red for a known list of
            // controllers; do it once those land.
            limit {
                counter = "INSTRUCTION"
                value = "COVEREDRATIO"
                minimum = "0.55".toBigDecimal()
            }
            // Branch coverage gate — the previous audit left branches
            // ungated entirely (today's run sits at ~48 %). Floor at 45 %
            // so a careless `if` cascade can't drag it below the current
            // baseline; lift toward 60 % once the importer tests land.
            limit {
                counter = "BRANCH"
                value = "COVEREDRATIO"
                minimum = "0.45".toBigDecimal()
            }
        }
    }
}

/**
 * JMH defaults: short, deterministic enough that a developer can run
 * them locally before a refactor without disappearing for the night.
 * The fork count stays at 1 for speed; for a publishable measurement
 * (numbers in CHANGELOG, ADR comparisons) bump to ≥ 2 manually.
 */
jmh {
    warmupIterations.set(2)
    iterations.set(3)
    fork.set(1)
    timeUnit.set("us")
    benchmarkMode.set(listOf("avgt"))
    resultFormat.set("JSON")
    resultsFile.set(file("build/reports/jmh/results.json"))
}
