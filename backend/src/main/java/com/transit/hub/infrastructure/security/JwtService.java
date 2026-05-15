package com.transit.hub.infrastructure.security;

import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.UserRole;
import com.transit.hub.infrastructure.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.UUID;
import java.util.function.Function;

@Service
@RequiredArgsConstructor
public class JwtService {

    private final JwtProperties props;

    /**
     * HS-family JWT keys must be at least 256 bits (32 bytes) for HS256.
     * Refuse to start with a shorter secret rather than silently accepting
     * a weak signing key.
     */
    @PostConstruct
    void validateSecretLength() {
        int bytes = props.secret().getBytes(StandardCharsets.UTF_8).length;
        if (bytes < 32) {
            throw new IllegalStateException(
                    "app.jwt.secret is too short: " + bytes
                            + " bytes (need >= 32). Generate one with: openssl rand -base64 48");
        }
    }

    public String generateToken(User user) {
        Instant now = Instant.now();
        Instant expiration = now.plus(props.expirationHours(), ChronoUnit.HOURS);

        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject(user.getUsername())
                .issuer(props.issuer())
                .audience().add(props.audience()).and()
                .claim("role", user.getRole().name())
                .claim("tv", user.getTokenVersion())
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiration))
                .signWith(getSigningKey())
                .compact();
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public UserRole extractRole(String token) {
        String role = extractClaim(token, claims -> claims.get("role", String.class));
        return UserRole.valueOf(role);
    }

    public long extractTokenVersion(String token) {
        Number tv = extractClaim(token, claims -> claims.get("tv", Number.class));
        // Tokens minted before V51 carry no "tv" claim; treat them as
        // version 0 so existing sessions stay valid until they expire
        // naturally rather than logging every active user out at once.
        return tv == null ? 0L : tv.longValue();
    }

    public String extractJti(String token) {
        return extractClaim(token, Claims::getId);
    }

    public Instant extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration).toInstant();
    }

    public boolean validateToken(String token, String username) {
        try {
            String extractedUsername = extractUsername(token);
            return extractedUsername.equals(username) && !isTokenExpired(token);
        } catch (Exception e) {
            return false;
        }
    }

    public boolean isValidToken(String token) {
        try {
            extractAllClaims(token);
            return !isTokenExpired(token);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Same 30-second leeway the front-end applies — keeps a freshly minted
     * token from being rejected when the client's clock drifts a few seconds
     * past the server's, e.g. after a laptop wakes from sleep.
     */
    private static final long CLOCK_SKEW_SECONDS = 30;

    private boolean isTokenExpired(String token) {
        return extractExpiration(token)
                .plusSeconds(CLOCK_SKEW_SECONDS)
                .isBefore(Instant.now());
    }

    private <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .clockSkewSeconds(CLOCK_SKEW_SECONDS)
                .requireIssuer(props.issuer())
                .requireAudience(props.audience())
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private SecretKey getSigningKey() {
        byte[] keyBytes = props.secret().getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
