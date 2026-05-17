package com.transit.hub.infrastructure.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.transit.hub.infrastructure.config.AuthProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthFilter;
    private final LoginRateLimitFilter loginRateLimitFilter;
    private final RefreshRateLimitFilter refreshRateLimitFilter;
    private final Environment environment;
    private final AuthProperties authProperties;
    private final MessageSource messageSource;

    @org.springframework.beans.factory.annotation.Value("${app.cors.allowed-origins:http://localhost:4200,http://localhost:3000}")
    private String allowedOriginsCsv;

    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        CsrfTokenRequestAttributeHandler csrfHandler = new CsrfTokenRequestAttributeHandler();
        csrfHandler.setCsrfRequestAttributeName(null);

        http
                .csrf(csrf -> csrf
                        .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                        .csrfTokenRequestHandler(csrfHandler)
                        // Only /api/auth/login is exempt (pre-auth: no XSRF cookie can
                        // exist yet), plus the rare stateless caller that arrives with
                        // an Authorization: Bearer header AND no auth cookie. Cookie
                        // carriers — including /refresh and /logout — go through CSRF
                        // because SameSite=Strict alone evaporates the moment a deploy
                        // flips it to Lax (one-click logout / forced refresh otherwise).
                        .requireCsrfProtectionMatcher(new CsrfProtectionMatcher(authProperties))
                )
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Public auth endpoints (login + refresh + logout). /me is left
                        // off the allowlist on purpose so an anonymous caller gets 401
                        // instead of an empty body — the controller is the only thing
                        // that can introspect the SecurityContext.
                        .requestMatchers(HttpMethod.POST, "/api/auth/login",
                                "/api/auth/refresh", "/api/auth/logout").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/auth/me").authenticated()
                        .requestMatchers("/api/display/**").permitAll()  // Public for kiosk displays
                        .requestMatchers("/api/network-map/**").permitAll()  // Public for network map
                        .requestMatchers(HttpMethod.GET, "/api/attributions").permitAll()  // Public credit block
                        .requestMatchers(HttpMethod.GET, "/api/fares/**").permitAll()  // Public fare calculator
                        .requestMatchers("/actuator/health").permitAll()
                        // Actuator surface, including the Prometheus scrape
                        // endpoint, requires ADMIN. Previous default left
                        // /prometheus permitAll which let any caller map
                        // the application's HTTP endpoint catalogue. A
                        // local Prometheus instance still works by either
                        // (a) attaching a basic-auth scrape config that
                        // hits the admin role, or (b) fencing the route
                        // off at the reverse-proxy layer.
                        .requestMatchers("/actuator/prometheus", "/actuator/metrics", "/actuator/info").hasRole("ADMIN")
                        // h2-console is a developer convenience — opening it
                        // outside the dev profile would expose the DB shell
                        // to anyone reaching the host. Profile-gated so a
                        // staging or prod deployment that accidentally ships
                        // with H2 on the classpath still fails closed.
                        .requestMatchers("/h2-console/**")
                                .access((authn, ctx) -> new org.springframework.security.authorization.AuthorizationDecision(
                                        environment.acceptsProfiles(Profiles.of("dev"))))
                        .requestMatchers("/ws/**").permitAll()
                        // OpenAPI / Springdoc UI — open in dev for browsing,
                        // ADMIN-only otherwise so the endpoint catalogue is
                        // not freely enumerable from a public deployment.
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html")
                                .access((authn, ctx) -> new org.springframework.security.authorization.AuthorizationDecision(
                                        environment.acceptsProfiles(Profiles.of("dev"))
                                                || (authn.get().isAuthenticated()
                                                        && authn.get().getAuthorities().stream()
                                                                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority())))
                                ))

                        // Read-only public access to itineraries (for schedule dialog)
                        .requestMatchers(HttpMethod.GET, "/api/itineraries/**").permitAll()

                        // Read-only public access to stop schedules (for network map timetable)
                        .requestMatchers(HttpMethod.GET, "/api/stops/*/schedules").permitAll()

                        // Read-only access for ADMIN + AGENT (for message scope selection)
                        .requestMatchers(HttpMethod.GET, "/api/lines/**").hasAnyRole("ADMIN", "AGENT")
                        .requestMatchers(HttpMethod.GET, "/api/stops/**").hasAnyRole("ADMIN", "AGENT")

                        // Admin only endpoints
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/itineraries/**").hasRole("ADMIN")
                        .requestMatchers("/api/lines/**").hasRole("ADMIN")
                        .requestMatchers("/api/stops/**").hasRole("ADMIN")
                        .requestMatchers("/api/schedules/**").hasRole("ADMIN")
                        .requestMatchers("/api/devices/**").hasRole("ADMIN")
                        .requestMatchers("/api/users/**").hasRole("ADMIN")

                        // Admin + Agent
                        .requestMatchers("/api/messages/**").hasAnyRole("ADMIN", "AGENT")

                        .anyRequest().authenticated()
                )
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setStatus(HttpStatus.UNAUTHORIZED.value());
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            objectMapper.writeValue(response.getOutputStream(), Map.of(
                                    "timestamp", Instant.now().toString(),
                                    "status", 401,
                                    "error", "Unauthorized",
                                    "message", localised("error.auth.required"),
                                    "path", request.getRequestURI()
                            ));
                        })
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            response.setStatus(HttpStatus.FORBIDDEN.value());
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            objectMapper.writeValue(response.getOutputStream(), Map.of(
                                    "timestamp", Instant.now().toString(),
                                    "status", 403,
                                    "error", "Forbidden",
                                    "message", localised("error.security.accessDenied"),
                                    "path", request.getRequestURI()
                            ));
                        })
                )
                .addFilterBefore(loginRateLimitFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(refreshRateLimitFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .headers(headers -> headers
                        // sameOrigin needed for the H2 console iframe in dev;
                        // CSP frame-ancestors below pins the same constraint.
                        .frameOptions(frame -> frame.sameOrigin())
                        .contentSecurityPolicy(csp -> csp.policyDirectives(
                                "default-src 'self'; "
                                        + "script-src 'self'; "
                                        + "style-src 'self' 'unsafe-inline'; "
                                        + "connect-src 'self' ws: wss:; "
                                        + "img-src 'self' data:; "
                                        + "frame-ancestors 'self'; "
                                        + "base-uri 'self'"))
                        // HSTS only outside dev — emitting Strict-Transport-Security
                        // on http://localhost:8080 forces every browser that hits
                        // the dev server to remember the host as HTTPS-only,
                        // which then breaks the next plain-HTTP visit until the
                        // header expires (two years here).
                        .httpStrictTransportSecurity(hsts -> {
                            if (environment.acceptsProfiles(Profiles.of("dev"))) {
                                hsts.disable();
                            } else {
                                hsts.includeSubDomains(true).maxAgeInSeconds(63072000L);
                            }
                        })
                        .referrerPolicy(rp -> rp.policy(
                                ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                );

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder(@Value("${app.security.bcrypt-strength:12}") int strength) {
        // Production cost = 12 — revisit every 24 months as hardware speeds up.
        // Tests override the property to 4 (the BCrypt minimum) so the suite
        // does not spend ~250 ms per encode call across hundreds of @BeforeEach
        // user seeds.
        return new BCryptPasswordEncoder(strength);
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(parseOrigins(allowedOriginsCsv));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setExposedHeaders(List.of("X-Device-Id", "WWW-Authenticate"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    private static List<String> parseOrigins(String csv) {
        return java.util.Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    /** Resolve a message key against the active locale (Accept-Language).
     *  Falls back to the key itself if a translation is missing so the
     *  response stays JSON-safe even on a misconfigured deploy. */
    private String localised(String key) {
        return messageSource.getMessage(key, null, key, LocaleContextHolder.getLocale());
    }
}
