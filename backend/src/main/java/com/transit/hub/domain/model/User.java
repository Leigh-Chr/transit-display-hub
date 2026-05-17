package com.transit.hub.domain.model;

import com.transit.hub.domain.model.enums.UserRole;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Version
    private Long version;

    @NotBlank(message = "Username is required")
    @Size(max = 50, message = "Username must be at most 50 characters")
    @Column(unique = true, nullable = false)
    private String username;

    @NotBlank(message = "Password is required")
    @Column(nullable = false)
    private String password;

    @NotNull(message = "Role is required")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserRole role;

    @Column(nullable = false)
    @Builder.Default
    private boolean enabled = true;

    /**
     * Forces the user to rotate the password on the next successful
     * login. Seeded {@code TRUE} for the admin row (Flyway V52) so the
     * default {@code admin / admin123} cannot stay live in production,
     * defaults {@code FALSE} for every other user the admin creates.
     */
    @Column(name = "password_must_change", nullable = false)
    @Builder.Default
    private boolean passwordMustChange = false;

    /**
     * Monotonic counter embedded inside every access token at mint time.
     * Bumping it invalidates every JWT this user currently holds — used
     * by disable, role change, password reset and revokeAllForUser.
     */
    @Column(name = "token_version", nullable = false)
    @Builder.Default
    private long tokenVersion = 0L;

    /**
     * Cleared from the password-rotation flow once a fresh password is
     * accepted. Exposed as a dedicated mutator (rather than relying on
     * the Lombok {@code @Setter}) so callers stay explicit about the
     * lifecycle event they trigger.
     */
    public void clearPasswordMustChange() {
        this.passwordMustChange = false;
    }
}
