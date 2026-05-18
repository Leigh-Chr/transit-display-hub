package com.transit.hub.infrastructure.security;

import com.transit.hub.infrastructure.persistence.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Objects;

/**
 * Bootstraps the admin password from {@code INITIAL_ADMIN_PASSWORD}
 * when the operator provides one, closing the deploy-window risk of
 * the {@code admin/admin123} seed in {@code V2__seed_admin_user.sql}.
 *
 * <p>The {@code prod} and {@code kiosk} profiles fail-fast at boot
 * when {@code INITIAL_ADMIN_PASSWORD} is unset (no default in
 * {@code application.yml}), matching the {@code JWT_SECRET} and
 * {@code DATABASE_PASSWORD} fail-closed pattern. Dev and test
 * profiles default the property to empty, which makes this loader a
 * no-op — V2's seed plus V52's {@code password_must_change = TRUE}
 * keeps the existing local DX intact.
 *
 * <p>The override is guarded on the seeded bcrypt hash so an admin
 * who has already rotated their credential is never silently reset
 * by a redeploy. The {@code passwordMustChange} flag is preserved
 * (still {@code TRUE}) so the first prod login still routes through
 * the change-password screen — defence in depth in case the operator
 * picked a placeholder.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AdminPasswordBootstrap implements CommandLineRunner {

    /** BCrypt hash of {@code admin123} shipped by V2 — kept in sync
     *  by hand because mining it from the migration at runtime would
     *  add a Flyway dependency to this bean. If the seed migration
     *  ever changes its hash, update this constant too. */
    static final String SEEDED_HASH =
            "$2b$10$28Te1rUTxBMomfpHWlV1ouAyJu0jI97.Yux6wb0p7N6asFDtq4C0q";

    static final String ADMIN_USERNAME = "admin";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.security.initial-admin-password:}")
    private @Nullable String initialAdminPassword;

    @Override
    public void run(String... args) {
        if (initialAdminPassword == null || initialAdminPassword.isBlank()) {
            log.debug("INITIAL_ADMIN_PASSWORD not configured — leaving seeded admin password in place");
            return;
        }
        userRepository.findByUsername(ADMIN_USERNAME).ifPresentOrElse(admin -> {
            if (SEEDED_HASH.equals(admin.getPassword())) {
                admin.setPassword(Objects.requireNonNull(
                        passwordEncoder.encode(initialAdminPassword),
                        "PasswordEncoder returned null hash"));
                admin.setPasswordMustChange(true);
                userRepository.save(admin);
                log.info("Replaced seeded admin password from INITIAL_ADMIN_PASSWORD; first login must still rotate");
            } else {
                log.debug("Admin password already rotated — INITIAL_ADMIN_PASSWORD ignored");
            }
        }, () -> log.warn("No admin user found — INITIAL_ADMIN_PASSWORD had nothing to apply"));
    }
}
