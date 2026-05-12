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
}
