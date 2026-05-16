package com.transit.hub.testutil;

import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.UserRole;
import com.transit.hub.infrastructure.persistence.UserRepository;
import com.transit.hub.infrastructure.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Provisions admin / agent test users and returns ready-to-use JWT
 * tokens. Centralises the {@code User.builder()...encode...generateToken}
 * boilerplate that 20+ controller integration tests used to duplicate
 * line for line in their {@code setUp()} blocks. Tests autowire this
 * helper (Spring will pick it up via {@code @Component}) instead of
 * wiring {@link UserRepository}, {@link PasswordEncoder} and
 * {@link JwtService} themselves when they don't otherwise need them.
 */
@Component
public class AuthTestHelper {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthTestHelper(UserRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    /** Creates an enabled admin {@code admin/admin123} and returns its JWT. */
    public String createAdminToken() {
        return createToken("admin", "admin123", UserRole.ADMIN);
    }

    /** Creates an enabled agent {@code agent/agent123} and returns its JWT. */
    public String createAgentToken() {
        return createToken("agent", "agent123", UserRole.AGENT);
    }

    /** Creates an enabled user with the given credentials/role and returns its JWT. */
    public String createToken(String username, String password, UserRole role) {
        User user = User.builder()
                .username(username)
                .password(passwordEncoder.encode(password))
                .role(role)
                .enabled(true)
                .build();
        userRepository.save(user);
        return jwtService.generateToken(user);
    }
}
