package com.transit.hub.infrastructure.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.info.BuildProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Springdoc configuration for the {@code /swagger-ui.html} +
 * {@code /v3/api-docs} surface. Declares the bearer-token security
 * scheme so the "Authorize" button on Swagger UI accepts the JWT
 * issued by {@code /api/auth/login}, lets developers exercise admin
 * endpoints without copy-pasting curl headers.
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI transitDisplayHubOpenAPI(ObjectProvider<BuildProperties> buildProperties) {
        SecurityScheme bearer = new SecurityScheme()
                .type(SecurityScheme.Type.HTTP)
                .scheme("bearer")
                .bearerFormat("JWT")
                .description("Paste the token from POST /api/auth/login. The same scheme " +
                        "powers every JWT-protected endpoint.");

        // BuildProperties is wired by Spring Boot's bootBuildInfo task
        // and reads the actual gradle version, so a tagged release sees
        // the same number on every artefact (jar, OpenAPI doc,
        // Actuator). The default "dev" only fires when the bootInfo
        // jar is missing (e.g. running from the IDE without bootRun).
        String version = buildProperties.stream()
                .map(BuildProperties::getVersion)
                .findFirst()
                .orElse("dev");

        return new OpenAPI()
                .info(new Info()
                        .title("Transit Display Hub API")
                        .version(version)
                        .description("Operator-facing REST API for the Transit Display Hub. "
                                + "Public endpoints (kiosk display, network map, attributions) require no auth; "
                                + "everything else expects a bearer JWT.")
                        .contact(new Contact().name("Transit Display Hub"))
                        .license(new License().name("Proprietary")))
                .components(new Components().addSecuritySchemes("bearer-jwt", bearer))
                .addSecurityItem(new SecurityRequirement().addList("bearer-jwt"));
    }
}
