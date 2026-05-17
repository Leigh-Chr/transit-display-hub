package com.transit.hub.api.rest;

import tools.jackson.databind.ObjectMapper;
import com.transit.hub.application.dto.request.LoginRequest;
import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.UserRole;
import com.transit.hub.infrastructure.persistence.UserRepository;
import com.transit.hub.infrastructure.security.LoginRateLimitFilter;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Execution(ExecutionMode.SAME_THREAD)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("AuthController Integration Tests")
class AuthControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private LoginRateLimitFilter loginRateLimitFilter;

    private User testAdmin;
    private User testAgent;
    private User disabledUser;

    @BeforeEach
    void setUp() {
        loginRateLimitFilter.clearBuckets();
        userRepository.deleteAll();

        testAdmin = User.builder()
                .username("admin")
                .password(passwordEncoder.encode("admin123"))
                .role(UserRole.ADMIN)
                .enabled(true)
                .build();
        userRepository.save(testAdmin);

        testAgent = User.builder()
                .username("agent")
                .password(passwordEncoder.encode("agent123"))
                .role(UserRole.AGENT)
                .enabled(true)
                .build();
        userRepository.save(testAgent);

        disabledUser = User.builder()
                .username("disabled")
                .password(passwordEncoder.encode("disabled123"))
                .role(UserRole.ADMIN)
                .enabled(false)
                .build();
        userRepository.save(disabledUser);
    }

    @Nested
    @DisplayName("POST /api/auth/login")
    class Login {

        @Test
        @DisplayName("returns 200 with token for valid admin credentials")
        void withValidAdminCredentials_Returns200() throws Exception {
            LoginRequest request = new LoginRequest("admin", "admin123");

            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.token", notNullValue()))
                    .andExpect(jsonPath("$.token", not(emptyString())))
                    .andExpect(jsonPath("$.role", is("ADMIN")))
                    .andExpect(jsonPath("$.username", is("admin")))
                    .andExpect(jsonPath("$.expiresAt", notNullValue()));
        }

        @Test
        @DisplayName("returns 200 with token for valid agent credentials")
        void withValidAgentCredentials_Returns200() throws Exception {
            LoginRequest request = new LoginRequest("agent", "agent123");

            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.token", notNullValue()))
                    .andExpect(jsonPath("$.role", is("AGENT")))
                    .andExpect(jsonPath("$.username", is("agent")));
        }

        @Test
        @DisplayName("returns 401 with invalid password")
        void withInvalidPassword_Returns401() throws Exception {
            LoginRequest request = new LoginRequest("admin", "wrongpassword");

            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("returns 401 with non-existent user")
        void withNonExistentUser_Returns401() throws Exception {
            LoginRequest request = new LoginRequest("nonexistent", "password");

            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("returns 401 for disabled user")
        void withDisabledUser_Returns401() throws Exception {
            LoginRequest request = new LoginRequest("disabled", "disabled123");

            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("returns 400 with missing username")
        void withMissingUsername_Returns400() throws Exception {
            String json = "{\"password\": \"password123\"}";

            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 400 with missing password")
        void withMissingPassword_Returns400() throws Exception {
            String json = "{\"username\": \"admin\"}";

            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 400 with empty request body")
        void withEmptyBody_Returns400() throws Exception {
            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 400 with blank username")
        void withBlankUsername_Returns400() throws Exception {
            String json = "{\"username\": \"\", \"password\": \"password123\"}";

            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 400 with blank password")
        void withBlankPassword_Returns400() throws Exception {
            String json = "{\"username\": \"admin\", \"password\": \"\"}";

            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("drops httpOnly ACCESS_TOKEN + REFRESH_TOKEN cookies on success")
        void setsAuthCookies() throws Exception {
            LoginRequest request = new LoginRequest("admin", "admin123");

            MvcResult result = mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andReturn();

            Cookie access = result.getResponse().getCookie("ACCESS_TOKEN");
            Cookie refresh = result.getResponse().getCookie("REFRESH_TOKEN");
            assertThat(access).isNotNull();
            assertThat(access.isHttpOnly()).isTrue();
            assertThat(access.getValue()).isNotBlank();
            assertThat(access.getPath()).isEqualTo("/");
            assertThat(refresh).isNotNull();
            assertThat(refresh.isHttpOnly()).isTrue();
            assertThat(refresh.getValue()).isNotBlank();
            assertThat(refresh.getPath()).isEqualTo("/api/auth");
        }
    }

    @Nested
    @DisplayName("POST /api/auth/refresh")
    class Refresh {

        @Test
        @DisplayName("returns 401 when refresh cookie is missing")
        void noCookie_Returns401() throws Exception {
            mockMvc.perform(post("/api/auth/refresh").with(csrf()))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("rotates the refresh cookie and mints a new access token")
        void withCookie_Returns200AndRotates() throws Exception {
            LoginRequest request = new LoginRequest("admin", "admin123");
            MvcResult login = mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andReturn();
            Cookie initialRefresh = login.getResponse().getCookie("REFRESH_TOKEN");
            assertThat(initialRefresh).isNotNull();

            MvcResult refresh = mockMvc.perform(post("/api/auth/refresh")
                            .cookie(initialRefresh)
                            .with(csrf()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.token", notNullValue()))
                    .andExpect(jsonPath("$.role", is("ADMIN")))
                    .andReturn();

            Cookie newAccess = refresh.getResponse().getCookie("ACCESS_TOKEN");
            Cookie newRefresh = refresh.getResponse().getCookie("REFRESH_TOKEN");
            assertThat(newAccess).isNotNull();
            assertThat(newRefresh).isNotNull();
            assertThat(newRefresh.getValue()).isNotEqualTo(initialRefresh.getValue());
        }

        @Test
        @DisplayName("rejects a refresh cookie that has already been rotated")
        void reusedCookie_Returns401() throws Exception {
            LoginRequest request = new LoginRequest("admin", "admin123");
            MvcResult login = mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andReturn();
            Cookie firstRefresh = login.getResponse().getCookie("REFRESH_TOKEN");

            mockMvc.perform(post("/api/auth/refresh").cookie(firstRefresh).with(csrf()))
                    .andExpect(status().isOk());

            // Replaying the now-rotated cookie must fail loud.
            mockMvc.perform(post("/api/auth/refresh").cookie(firstRefresh).with(csrf()))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("rejects a refresh attempt that arrives without a CSRF token")
        void missingCsrfToken_Returns403() throws Exception {
            LoginRequest request = new LoginRequest("admin", "admin123");
            MvcResult login = mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andReturn();
            Cookie refresh = login.getResponse().getCookie("REFRESH_TOKEN");

            // No .with(csrf()) — exactly the cross-site-form-without-the-header
            // attack that the previous /api/auth/** exemption silently allowed.
            mockMvc.perform(post("/api/auth/refresh").cookie(refresh))
                    .andExpect(status().isForbidden());
        }
    }

    @Nested
    @DisplayName("POST /api/auth/logout")
    class Logout {

        @Test
        @DisplayName("clears both auth cookies and returns 204")
        void clearsCookies() throws Exception {
            LoginRequest request = new LoginRequest("admin", "admin123");
            MvcResult login = mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andReturn();
            Cookie refresh = login.getResponse().getCookie("REFRESH_TOKEN");

            MvcResult logout = mockMvc.perform(post("/api/auth/logout")
                            .cookie(refresh)
                            .with(csrf()))
                    .andExpect(status().isNoContent())
                    .andReturn();

            Cookie clearedAccess = logout.getResponse().getCookie("ACCESS_TOKEN");
            Cookie clearedRefresh = logout.getResponse().getCookie("REFRESH_TOKEN");
            assertThat(clearedAccess).isNotNull();
            assertThat(clearedAccess.getMaxAge()).isZero();
            assertThat(clearedRefresh).isNotNull();
            assertThat(clearedRefresh.getMaxAge()).isZero();
        }

        @Test
        @DisplayName("is idempotent when called without a refresh cookie")
        void noCookie_Returns204() throws Exception {
            mockMvc.perform(post("/api/auth/logout").with(csrf()))
                    .andExpect(status().isNoContent());
        }

        @Test
        @DisplayName("rejects a logout attempt that arrives without a CSRF token")
        void missingCsrfToken_Returns403() throws Exception {
            LoginRequest request = new LoginRequest("admin", "admin123");
            MvcResult login = mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andReturn();
            Cookie refresh = login.getResponse().getCookie("REFRESH_TOKEN");

            // No .with(csrf()) — would let a cross-site form involuntarily
            // log the user out via cookie SameSite=Lax. CSRF must close it.
            mockMvc.perform(post("/api/auth/logout").cookie(refresh))
                    .andExpect(status().isForbidden());
        }
    }

    @Nested
    @DisplayName("POST /api/auth/change-password")
    class ChangePassword {

        @Test
        @DisplayName("rotates the password and clears the must-change flag")
        void rotatesPasswordAndClearsFlag() throws Exception {
            // Mark the seeded admin as having to rotate, matching the V52 default.
            testAdmin.setPasswordMustChange(true);
            userRepository.save(testAdmin);

            LoginRequest loginRequest = new LoginRequest("admin", "admin123");
            MvcResult login = mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(loginRequest)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.passwordMustChange", is(true)))
                    .andReturn();
            Cookie access = login.getResponse().getCookie("ACCESS_TOKEN");
            assertThat(access).isNotNull();

            String payload = """
                    { "currentPassword": "admin123", "newPassword": "Brand-New-Str0ng-Pass!" }
                    """;
            mockMvc.perform(post("/api/auth/change-password")
                            .cookie(access)
                            .with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payload))
                    .andExpect(status().isNoContent());

            User reloaded = userRepository.findByUsername("admin").orElseThrow();
            assertThat(reloaded.isPasswordMustChange()).isFalse();
            assertThat(passwordEncoder.matches("Brand-New-Str0ng-Pass!", reloaded.getPassword())).isTrue();
        }

        @Test
        @DisplayName("rejects a new password shorter than the minimum length")
        void rejectsWeakPassword() throws Exception {
            LoginRequest loginRequest = new LoginRequest("admin", "admin123");
            MvcResult login = mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(loginRequest)))
                    .andReturn();
            Cookie access = login.getResponse().getCookie("ACCESS_TOKEN");

            String payload = """
                    { "currentPassword": "admin123", "newPassword": "weak" }
                    """;
            mockMvc.perform(post("/api/auth/change-password")
                            .cookie(access)
                            .with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payload))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("rejects a wrong current password with 401")
        void rejectsWrongCurrentPassword() throws Exception {
            LoginRequest loginRequest = new LoginRequest("admin", "admin123");
            MvcResult login = mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(loginRequest)))
                    .andReturn();
            Cookie access = login.getResponse().getCookie("ACCESS_TOKEN");

            String payload = """
                    { "currentPassword": "wrong-password", "newPassword": "Brand-New-Str0ng-Pass!" }
                    """;
            mockMvc.perform(post("/api/auth/change-password")
                            .cookie(access)
                            .with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payload))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("rejects an unauthenticated caller with 401")
        void rejectsUnauthenticated() throws Exception {
            String payload = """
                    { "currentPassword": "admin123", "newPassword": "Brand-New-Str0ng-Pass!" }
                    """;
            mockMvc.perform(post("/api/auth/change-password")
                            .with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payload))
                    .andExpect(status().isUnauthorized());
        }
    }

    @Nested
    @DisplayName("GET /api/auth/me")
    class Me {

        @Test
        @DisplayName("returns 401 without authentication")
        void unauthenticated_Returns401() throws Exception {
            mockMvc.perform(get("/api/auth/me"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("returns user identity for an authenticated caller")
        void authenticated_ReturnsUser() throws Exception {
            LoginRequest request = new LoginRequest("admin", "admin123");
            MvcResult login = mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andReturn();
            String body = login.getResponse().getContentAsString();
            String token = objectMapper.readTree(body).get("token").asString();

            mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.username", is("admin")))
                    .andExpect(jsonPath("$.role", is("ADMIN")));
        }
    }
}
