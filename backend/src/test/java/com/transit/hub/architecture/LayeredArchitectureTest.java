package com.transit.hub.architecture;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

/**
 * Enforces the layered architecture documented in
 * {@code docs/developer-guide.md} § "Package Structure".
 *
 * <p>Domain code must remain pure: it can only depend on other
 * domain classes, the standard library and a handful of common
 * cross-cutting libraries (slf4j, lombok). It must <em>not</em>
 * reach into {@code infrastructure} (repositories, realtime
 * caches, configuration) or into {@code application} (DTOs,
 * services, exceptions).
 *
 * <p>Allowlist (frozen exceptions kept in code rather than in a
 * sidecar violations store, so each entry is visible at review
 * time and easy to remove once the underlying class is moved):
 *
 * <ul>
 *   <li>{@code DisplayStateCalculator} currently reaches into
 *   {@code infrastructure.persistence.*}, {@code infrastructure.realtime.*}
 *   and {@code application.dto.*}. The move to {@code application.service}
 *   is planned in the next minor (see
 *   {@code .planning/refactors/2026-05-12-maintainability-guardrails.md}
 *   § "Après Phase 1").</li>
 *   <li>{@code VehiclePositionResponse} and {@code RealtimeAlertResponse}
 *   expose a {@code from(cacheSnapshot)} factory that takes an inner
 *   record of {@code RealtimeVehiclePositionCache} / {@code RealtimeAlertCache}.
 *   The shape-adapter belongs in the cache or in a dedicated mapper;
 *   relocation tracked together with the {@code DisplayStateCalculator}
 *   move.</li>
 * </ul>
 *
 * <p>Removing an allowlist entry should always be paired with
 * the corresponding refactor commit.
 */
@AnalyzeClasses(
    packages = "com.transit.hub",
    importOptions = ImportOption.DoNotIncludeTests.class
)
class LayeredArchitectureTest {

    private static final String DISPLAY_STATE_CALCULATOR =
        "com.transit.hub.domain.service.DisplayStateCalculator";

    private static final String VEHICLE_POSITION_RESPONSE =
        "com.transit.hub.application.dto.response.VehiclePositionResponse";

    private static final String REALTIME_ALERT_RESPONSE =
        "com.transit.hub.application.dto.response.RealtimeAlertResponse";

    @ArchTest
    static final ArchRule domainDoesNotDependOnInfrastructure =
        noClasses()
            .that().resideInAPackage("..domain..")
            .and().doNotHaveFullyQualifiedName(DISPLAY_STATE_CALCULATOR)
            .should().dependOnClassesThat()
            .resideInAPackage("..infrastructure..")
            .as("domain classes must not depend on infrastructure");

    @ArchTest
    static final ArchRule domainDoesNotDependOnApplication =
        noClasses()
            .that().resideInAPackage("..domain..")
            .and().doNotHaveFullyQualifiedName(DISPLAY_STATE_CALCULATOR)
            .should().dependOnClassesThat()
            .resideInAPackage("..application..")
            .as("domain classes must not depend on application "
                + "(DTOs, services, exceptions)");

    @ArchTest
    static final ArchRule applicationDtoDoesNotDependOnInfrastructure =
        noClasses()
            .that().resideInAPackage("..application.dto..")
            .and().doNotHaveFullyQualifiedName(VEHICLE_POSITION_RESPONSE)
            .and().doNotHaveFullyQualifiedName(REALTIME_ALERT_RESPONSE)
            .should().dependOnClassesThat()
            .resideInAPackage("..infrastructure..")
            .as("DTOs must remain free of infrastructure dependencies");

    @ArchTest
    static final ArchRule applicationDtoDoesNotDependOnApplicationService =
        noClasses()
            .that().resideInAPackage("..application.dto..")
            .should().dependOnClassesThat()
            .resideInAPackage("..application.service..")
            .as("DTOs must not call back into application services");
}
