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
 * <p>The allowlist is intentionally empty: every package boundary
 * holds without name-based exemption. When a future refactor needs
 * a temporary frozen exception, add a {@code private static final
 * String} constant and an {@code .and().doNotHaveFullyQualifiedName(...)}
 * clause to the relevant rule, and document the planned phase that
 * will retire the entry.
 */
@AnalyzeClasses(
    packages = "com.transit.hub",
    importOptions = ImportOption.DoNotIncludeTests.class
)
class LayeredArchitectureTest {

    @ArchTest
    static final ArchRule domainDoesNotDependOnInfrastructure =
        noClasses()
            .that().resideInAPackage("..domain..")
            .should().dependOnClassesThat()
            .resideInAPackage("..infrastructure..")
            .as("domain classes must not depend on infrastructure");

    @ArchTest
    static final ArchRule domainDoesNotDependOnApplication =
        noClasses()
            .that().resideInAPackage("..domain..")
            .should().dependOnClassesThat()
            .resideInAPackage("..application..")
            .as("domain classes must not depend on application "
                + "(DTOs, services, exceptions)");

    @ArchTest
    static final ArchRule applicationDtoDoesNotDependOnInfrastructure =
        noClasses()
            .that().resideInAPackage("..application.dto..")
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

    /**
     * API controllers must go through application services. Pulling
     * a repository or a realtime cache directly into a controller
     * blurs the layer boundary and bypasses every cross-cutting
     * concern (logging, transactions, mapping) the application
     * services are supposed to own.
     *
     * <p>The 2026-05-16 audit caught three contraventions (audit P1
     * B-3): {@code AuthController} reading from {@code UserRepository}
     * for {@code /me}, and the two realtime endpoints reading from
     * {@code RealtimeAlertCache} / {@code RealtimeVehiclePositionCache}.
     * They are now mediated by dedicated application services
     * ({@code AuthService#getCurrentUser}, {@code RealtimeAdminService}),
     * so the rule fires green and stays a gate for new code.
     */
    @ArchTest
    static final ArchRule apiDoesNotDependOnInfrastructurePersistence =
        noClasses()
            .that().resideInAPackage("..api..")
            .should().dependOnClassesThat()
            .resideInAPackage("..infrastructure.persistence..")
            .as("API controllers must go through application services, "
                + "never call a repository directly");

    @ArchTest
    static final ArchRule apiDoesNotDependOnInfrastructureRealtime =
        noClasses()
            .that().resideInAPackage("..api..")
            .should().dependOnClassesThat()
            .resideInAPackage("..infrastructure.realtime..")
            .as("API controllers must go through application services, "
                + "never call a realtime cache directly");
}
