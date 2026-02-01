package com.transit.hub.api.rest;

import tools.jackson.databind.ObjectMapper;
import com.transit.hub.application.dto.request.LoginRequest;
import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.UserRole;
import com.transit.hub.infrastructure.persistence.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

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

    private User testAdmin;
    private User testAgent;
    private User disabledUser;

    @BeforeEach
    void setUp() {
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
    }
}
