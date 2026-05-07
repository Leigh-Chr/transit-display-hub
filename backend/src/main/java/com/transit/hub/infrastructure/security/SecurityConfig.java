package com.transit.hub.infrastructure.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
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

    @org.springframework.beans.factory.annotation.Value("${app.cors.allowed-origins:http://localhost:4200,http://localhost:3000}")
    private String allowedOriginsCsv;

    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Public endpoints
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/api/devices/authenticate").permitAll()
                        .requestMatchers("/api/display/**").permitAll()  // Public for kiosk displays
                        .requestMatchers("/api/network-map/**").permitAll()  // Public for network map
                        .requestMatchers(HttpMethod.GET, "/api/attributions").permitAll()  // Public credit block
                        .requestMatchers("/actuator/health").permitAll()
                        .requestMatchers("/h2-console/**").permitAll()
                        .requestMatchers("/ws/**").permitAll()
                        // OpenAPI / Swagger UI — Springdoc serves the spec
                        // and the UI on these paths. Both are read-only and
                        // describe only the endpoint shape, not the data,
                        // so leaving them open keeps the docs reachable
                        // for external dev tooling. Production deployments
                        // can fence them off via reverse-proxy rules if
                        // desired.
                        .requestMatchers("/v3/api-docs/**").permitAll()
                        .requestMatchers("/swagger-ui/**").permitAll()
                        .requestMatchers("/swagger-ui.html").permitAll()

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
                                    "message", "Authentication required",
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
                                    "message", "Access denied: insufficient permissions",
                                    "path", request.getRequestURI()
                            ));
                        })
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                // For H2 console
                .headers(headers -> headers.frameOptions(frame -> frame.sameOrigin()));

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
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
}
