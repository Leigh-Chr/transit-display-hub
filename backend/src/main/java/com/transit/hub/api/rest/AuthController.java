package com.transit.hub.api.rest;

import com.transit.hub.application.dto.LoginBundle;
import com.transit.hub.application.dto.request.LoginRequest;
import com.transit.hub.application.dto.response.LoginResponse;
import com.transit.hub.application.dto.response.MeResponse;
import com.transit.hub.application.service.AuthService;
import com.transit.hub.domain.model.User;
import com.transit.hub.infrastructure.persistence.UserRepository;
import com.transit.hub.infrastructure.security.AuthCookieFactory;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Authentification",
     description = "Login JWT pour les administrateurs et les agents.")
public class AuthController {

    private final AuthService authService;
    private final AuthCookieFactory cookieFactory;
    private final UserRepository userRepository;

    @PostMapping("/login")
    @Operation(summary = "Authentifie un utilisateur",
               description = "Pose les cookies httpOnly (accès + refresh) et renvoie le "
                       + "même JWT dans le body pour rétro-compatibilité avec le bouton "
                       + "Authorize de Swagger UI.")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request,
                                               HttpServletRequest httpRequest) {
        String userAgent = httpRequest.getHeader(HttpHeaders.USER_AGENT);
        String ipAddress = httpRequest.getRemoteAddr();
        LoginBundle bundle = authService.loginWithRefresh(request, userAgent, ipAddress);
        return withAuthCookies(bundle).body(bundle.loginResponse());
    }

    @PostMapping("/refresh")
    @Operation(summary = "Renouvelle l'access token via le cookie refresh",
               description = "Lit le cookie refresh httpOnly, le tourne (révoque + remplace) "
                       + "et émet un nouvel access token en cookie + dans le body.")
    public ResponseEntity<LoginResponse> refresh(HttpServletRequest httpRequest) {
        String refreshRaw = readCookie(httpRequest, cookieFactory.getRefreshCookieName())
                .orElseThrow(() -> new BadCredentialsException("Missing refresh cookie"));
        String userAgent = httpRequest.getHeader(HttpHeaders.USER_AGENT);
        String ipAddress = httpRequest.getRemoteAddr();
        LoginBundle bundle = authService.refresh(refreshRaw, userAgent, ipAddress);
        return withAuthCookies(bundle).body(bundle.loginResponse());
    }

    @PostMapping("/logout")
    @Operation(summary = "Révoque la session courante",
               description = "Révoque le refresh token côté serveur et purge les deux "
                       + "cookies côté client.")
    public ResponseEntity<Void> logout(HttpServletRequest httpRequest) {
        readCookie(httpRequest, cookieFactory.getRefreshCookieName())
                .ifPresent(authService::logout);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, cookieFactory.clearAccessCookie().toString())
                .header(HttpHeaders.SET_COOKIE, cookieFactory.clearRefreshCookie().toString())
                .build();
    }

    @GetMapping("/me")
    @Operation(summary = "Retourne l'identité de l'utilisateur courant",
               description = "Permet au front de reconstruire l'état d'authentification après "
                       + "un rechargement quand le token vit dans un cookie httpOnly.")
    public ResponseEntity<MeResponse> me(Authentication authentication) {
        if (authentication == null
                || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getName())) {
            return ResponseEntity.status(401).build();
        }
        return userRepository.findByUsername(authentication.getName())
                .map(this::toMeResponse)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(401).build());
    }

    private ResponseEntity.BodyBuilder withAuthCookies(LoginBundle bundle) {
        ResponseCookie accessCookie = cookieFactory.buildAccessCookie(
                bundle.loginResponse().token(),
                java.time.Duration.between(java.time.Instant.now(), bundle.loginResponse().expiresAt()));
        ResponseCookie refreshCookie = cookieFactory.buildRefreshCookie(
                bundle.refreshTokenRaw(),
                bundle.refreshTokenTtl());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, accessCookie.toString())
                .header(HttpHeaders.SET_COOKIE, refreshCookie.toString());
    }

    private MeResponse toMeResponse(User user) {
        return new MeResponse(user.getUsername(), user.getRole());
    }

    private static Optional<String> readCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return Optional.empty();
        }
        return Arrays.stream(cookies)
                .filter(c -> name.equals(c.getName()))
                .map(Cookie::getValue)
                .filter(v -> v != null && !v.isBlank())
                .findFirst();
    }
}
