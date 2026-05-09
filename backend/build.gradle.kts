plugins {
    java
    id("org.springframework.boot") version "4.0.2"
    id("io.spring.dependency-management") version "1.1.7"
    id("com.google.protobuf") version "0.9.4"
    // Official JMH plugin — provides the `jmh` source set, the
    // {@code jmh} verification task, annotation-processor wiring for
    // the @Benchmark indexer, and a sensible default fork / warmup
    // configuration. Out-of-band of the standard test task so a JMH
    // run stays explicit (`./gradlew jmh`) and never blocks CI.
    id("me.champeau.jmh") version "0.7.2"
}

group = "com.transit"
version = "0.0.1-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

configurations {
    compileOnly {
        extendsFrom(configurations.annotationProcessor.get())
    }
    // The integration JMH benchmarks need every Spring Boot starter and
    // every test-time helper (in-memory H2, JWT setup) on the runtime
    // path. Inheriting from runtimeClasspath gives us the production
    // surface without copy-pasting dependency lines into the jmh block.
    named("jmhImplementation") {
        extendsFrom(configurations.implementation.get())
        extendsFrom(configurations.runtimeOnly.get())
    }
    named("jmhAnnotationProcessor") {
        extendsFrom(configurations.annotationProcessor.get())
    }
}

repositories {
    mavenCentral()
}

dependencies {
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
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.7.0")

    // GTFS-Realtime — Protobuf bindings generated from the official
    // gtfs-realtime.proto file in src/main/proto/. Used by the
    // ServiceAlerts cache to surface operator-pushed alerts on
    // kiosks and hubs.
    implementation("com.google.protobuf:protobuf-java:3.25.5")

    // Database
    runtimeOnly("com.h2database:h2")
    runtimeOnly("org.postgresql:postgresql")

    // Flyway
    implementation("org.springframework.boot:spring-boot-starter-flyway")
    implementation("org.flywaydb:flyway-database-postgresql")

    // Lombok
    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")

    // DevTools
    developmentOnly("org.springframework.boot:spring-boot-devtools")

    // Testing
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
    testImplementation("org.springframework.boot:spring-boot-data-jpa-test")
    testImplementation("org.springframework.security:spring-security-test")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

// Protobuf code generation for gtfs-realtime.proto. The plugin
// downloads the protoc binary from Maven Central as a Maven artefact;
// no system-wide protoc install required.
protobuf {
    protoc {
        artifact = "com.google.protobuf:protoc:3.25.5"
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
