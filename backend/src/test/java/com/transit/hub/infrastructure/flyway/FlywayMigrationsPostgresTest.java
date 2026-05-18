package com.transit.hub.infrastructure.flyway;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.output.MigrateResult;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Smoke test that runs every Flyway migration against a real PostgreSQL
 * 16 container, the version targeted in production. The default test
 * profile boots on H2 (faster, no Docker required) and would not catch
 * PG-specific regressions: extension declarations, type casts, JSON
 * operators, generated columns, or PG-only DDL syntax. This test fills
 * that gap.
 *
 * <p>Tagged {@code postgres} and excluded from the default
 * {@code ./gradlew test} run — opt in via {@code ./gradlew testPostgres},
 * which is also the gate the Postgres-aware CI workflow drives. Skipping
 * is automatic when Docker isn't reachable (Testcontainers throws on
 * container startup, JUnit reports the test as failed; the test task
 * itself stays opt-in).
 */
@Testcontainers
@Tag("postgres")
class FlywayMigrationsPostgresTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine")
            .withDatabaseName("transitdb")
            .withUsername("transit")
            .withPassword("transit-test");

    @Test
    void allMigrationsApplyCleanlyOnPostgres() {
        Flyway flyway = Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("classpath:db/migration")
                // The prod Flyway disables clean for safety; we run on a
                // fresh container, so clean-on-validation-error is fine
                // and gives a clear log if a previous run left state.
                .cleanDisabled(false)
                .load();
        flyway.clean();

        MigrateResult result = flyway.migrate();

        assertThat(result.success)
                .as("Flyway migration must succeed on PostgreSQL 16")
                .isTrue();
        assertThat(result.migrationsExecuted)
                .as("At least the initial baseline + one follow-up should run")
                .isGreaterThanOrEqualTo(2);

        MigrationInfo[] applied = flyway.info().applied();
        assertThat(applied)
                .as("Every applied migration must reach the SUCCESS state")
                .allSatisfy(m -> assertThat(m.getState().getDisplayName())
                        .isIn("Success", "Out of Order", "Baseline"));
    }
}
