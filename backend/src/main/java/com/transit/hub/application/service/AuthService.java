package com.transit.hub.application.service;

import com.transit.hub.application.dto.LoginBundle;
import com.transit.hub.application.dto.request.ChangePasswordRequest;
import com.transit.hub.application.dto.request.LoginRequest;
import com.transit.hub.application.dto.response.LoginResponse;
import com.transit.hub.application.dto.response.MeResponse;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.domain.model.User;
import com.transit.hub.infrastructure.persistence.UserRepository;
import com.transit.hub.infrastructure.security.JwtService;
import com.transit.hub.infrastructure.security.RefreshTokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final Clock clock;

    /**
     * Access-token-only flow used exclusively by {@code AuthServiceTest}
     * to exercise {@link #authenticate} without having to stub
     * {@link RefreshTokenService}. Production controllers should always
     * call {@link #loginWithRefresh} so the cookie-based session is
     * established on the response. Confirmed test-surface-only by the
     * cross-axis audit (HEAD 5247109): zero production callers.
     */
    public LoginResponse login(LoginRequest request) {
        User user = authenticate(request);
        String token = jwtService.generateToken(user);
        return new LoginResponse(
                token,
                jwtService.extractExpiration(token),
                user.getRole(),
                user.getUsername(),
                user.isPasswordMustChange()
        );
    }

    @Transactional
    public LoginBundle loginWithRefresh(LoginRequest request, String userAgent, String ipAddress) {
        User user = authenticate(request);
        String access = jwtService.generateToken(user);
        Instant accessExpiresAt = jwtService.extractExpiration(access);
        RefreshTokenService.Issued refresh = refreshTokenService.issue(user, userAgent, ipAddress);

        LoginResponse body = new LoginResponse(
                access, accessExpiresAt, user.getRole(), user.getUsername(), user.isPasswordMustChange());
        return new LoginBundle(body, refresh.rawToken(), ttl(refresh.entity().getExpiresAt()));
    }

    @Transactional
    public LoginBundle refresh(String refreshRaw, String userAgent, String ipAddress) {
        RefreshTokenService.Issued rotated = refreshTokenService.rotate(refreshRaw, userAgent, ipAddress);
        User user = rotated.entity().getUser();
        String access = jwtService.generateToken(user);
        Instant accessExpiresAt = jwtService.extractExpiration(access);

        LoginResponse body = new LoginResponse(
                access, accessExpiresAt, user.getRole(), user.getUsername(), user.isPasswordMustChange());
        return new LoginBundle(body, rotated.rawToken(), ttl(rotated.entity().getExpiresAt()));
    }

    public void logout(String refreshRaw) {
        if (refreshRaw == null || refreshRaw.isBlank()) {
            return;
        }
        refreshTokenService.revoke(refreshRaw);
    }

    /**
     * Rotates the password of the authenticated caller. Clears the
     * {@code passwordMustChange} flag so the next login no longer
     * redirects to the rotation screen. Wrong {@code currentPassword}
     * is surfaced as {@link BadCredentialsException} (401) by the
     * global exception handler.
     */
    @Transactional
    public void changePassword(String username, ChangePasswordRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User", username));

        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new BadCredentialsException("Invalid current password");
        }

        user.setPassword(java.util.Objects.requireNonNull(
                passwordEncoder.encode(request.newPassword()),
                "PasswordEncoder returned null hash"));
        user.clearPasswordMustChange();
    }

    private User authenticate(LoginRequest request) {
        User user = userRepository.findByUsername(request.username())
                .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));

        if (!user.isEnabled()) {
            throw new BadCredentialsException("Account is disabled");
        }

        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new BadCredentialsException("Invalid credentials");
        }

        return user;
    }

    private Duration ttl(Instant expiresAt) {
        Duration left = Duration.between(clock.instant(), expiresAt);
        return left.isNegative() ? Duration.ZERO : left;
    }

    /**
     * Resolve the authenticated user's identity for the /me endpoint.
     * Returns empty when the user record has been deleted/disabled
     * between the JWT issuance and the request — the controller maps
     * that to a 401 so the front re-authenticates.
     */
    @Transactional(readOnly = true)
    public Optional<MeResponse> getCurrentUser(String username) {
        return userRepository.findByUsername(username)
                .map(user -> new MeResponse(user.getUsername(), user.getRole()));
    }
}
