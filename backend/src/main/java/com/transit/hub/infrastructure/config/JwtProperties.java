package com.transit.hub.infrastructure.config;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Typed view of the {@code app.jwt.*} block. Replacing the scattered
 * {@code @Value("${app.jwt....}")} reads with a single bean lets us
 * validate at startup (a missing secret blows up loudly) and document
 * the surface in one place.
 */
@ConfigurationProperties(prefix = "app.jwt")
@Validated
public record JwtProperties(
        @NotBlank String secret,
        @Min(1) int expirationHours,
        String issuer,
        String audience,
        @Min(1) int refreshExpirationDays
) {
    public JwtProperties {
        if (issuer == null || issuer.isBlank()) {
            issuer = "transit-display-hub";
        }
        if (audience == null || audience.isBlank()) {
            audience = "transit-display-hub-admin";
        }
        if (refreshExpirationDays == 0) {
            refreshExpirationDays = 14;
        }
    }
}
