package com.transit.hub.api.rest;

import tools.jackson.databind.ObjectMapper;
import com.transit.hub.application.dto.request.CreateUserRequest;
import com.transit.hub.application.dto.request.UpdateUserRequest;
import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.UserRole;
import com.transit.hub.infrastructure.persistence.UserRepository;
import com.transit.hub.infrastructure.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Execution(ExecutionMode.SAME_THREAD)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("UserController Integration Tests")
class UserControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    private String adminToken;
    private String agentToken;
    private User testAdmin;
    private User testAgent;

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
        adminToken = jwtService.generateToken(testAdmin);

        testAgent = User.builder()
                .username("agent")
                .password(passwordEncoder.encode("agent123"))
                .role(UserRole.AGENT)
                .enabled(true)
                .build();
        userRepository.save(testAgent);
        agentToken = jwtService.generateToken(testAgent);
    }

    @Nested
    @DisplayName("GET /api/users")
    class GetAllUsers {

        @Test
        @DisplayName("returns 200 with all users for ADMIN")
        void withAdminRole_Returns200() throws Exception {
            mockMvc.perform(get("/api/users")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(2)));
        }

        @Test
        @DisplayName("returns 401 without authentication")
        void withoutAuth_Returns401() throws Exception {
            mockMvc.perform(get("/api/users"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.message", is("Authentication required")));
        }

        @Test
        @DisplayName("returns 401 with localised FR message when Accept-Language=fr")
        void withoutAuth_Returns401LocalisedFr() throws Exception {
            mockMvc.perform(get("/api/users").header("Accept-Language", "fr"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.message", is("Authentification requise")));
        }

        @Test
        @DisplayName("returns 403 for AGENT role")
        void withAgentRole_Returns403() throws Exception {
            mockMvc.perform(get("/api/users")
                            .header("Authorization", "Bearer " + agentToken))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.message", is("Access denied: insufficient permissions")));
        }

        @Test
        @DisplayName("returns 403 with localised FR message when Accept-Language=fr")
        void withAgentRole_Returns403LocalisedFr() throws Exception {
            mockMvc.perform(get("/api/users")
                            .header("Authorization", "Bearer " + agentToken)
                            .header("Accept-Language", "fr"))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.message", is("Accès refusé : permissions insuffisantes")));
        }
    }

    @Nested
    @DisplayName("GET /api/users (paginated)")
    class GetAllUsersPaginated {

        @Test
        @DisplayName("returns paginated results with search")
        void withPaginationAndSearch_Returns200() throws Exception {
            mockMvc.perform(get("/api/users")
                            .param("page", "0")
                            .param("size", "10")
                            .param("search", "admin")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(1)))
                    .andExpect(jsonPath("$.content[0].username", is("admin")))
                    .andExpect(jsonPath("$.totalElements", is(1)));
        }

        @Test
        @DisplayName("returns all users when no search")
        void withPaginationNoSearch_Returns200() throws Exception {
            mockMvc.perform(get("/api/users")
                            .param("page", "0")
                            .param("size", "10")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(2)))
                    .andExpect(jsonPath("$.totalElements", is(2)));
        }
    }

    @Nested
    @DisplayName("GET /api/users/{id}")
    class GetUser {

        @Test
        @DisplayName("returns 200 with user for valid ID")
        void withValidId_Returns200() throws Exception {
            mockMvc.perform(get("/api/users/" + testAdmin.getId())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id", is(testAdmin.getId().toString())))
                    .andExpect(jsonPath("$.username", is("admin")))
                    .andExpect(jsonPath("$.role", is("ADMIN")))
                    .andExpect(jsonPath("$.enabled", is(true)));
        }

        @Test
        @DisplayName("returns 404 for non-existent ID")
        void withNonExistentId_Returns404() throws Exception {
            mockMvc.perform(get("/api/users/" + UUID.randomUUID())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("POST /api/users")
    class CreateUser {

        @Test
        @DisplayName("returns 201 with created user for ADMIN")
        void withAdminRole_Returns201() throws Exception {
            CreateUserRequest request = new CreateUserRequest("newuser", "password1234", UserRole.AGENT);

            mockMvc.perform(post("/api/users")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id", notNullValue()))
                    .andExpect(jsonPath("$.username", is("newuser")))
                    .andExpect(jsonPath("$.role", is("AGENT")))
                    .andExpect(jsonPath("$.enabled", is(true)));
        }

        @Test
        @DisplayName("returns 403 for AGENT role")
        void withAgentRole_Returns403() throws Exception {
            CreateUserRequest request = new CreateUserRequest("newuser", "password1234", UserRole.AGENT);

            mockMvc.perform(post("/api/users")
                            .header("Authorization", "Bearer " + agentToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("returns 400 for duplicate username")
        void withDuplicateUsername_Returns400() throws Exception {
            CreateUserRequest request = new CreateUserRequest("admin", "password1234", UserRole.ADMIN);

            mockMvc.perform(post("/api/users")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 400 with blank username")
        void withBlankUsername_Returns400() throws Exception {
            String json = "{\"username\": \"\", \"password\": \"password1234\", \"role\": \"ADMIN\"}";

            mockMvc.perform(post("/api/users")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 400 with short password")
        void withShortPassword_Returns400() throws Exception {
            String json = "{\"username\": \"newuser\", \"password\": \"ab\", \"role\": \"ADMIN\"}";

            mockMvc.perform(post("/api/users")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 400 with missing role")
        void withMissingRole_Returns400() throws Exception {
            String json = "{\"username\": \"newuser\", \"password\": \"password1234\"}";

            mockMvc.perform(post("/api/users")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json))
                    .andExpect(status().isBadRequest());
        }
    }

    @Nested
    @DisplayName("PUT /api/users/{id}")
    class UpdateUser {

        @Test
        @DisplayName("returns 200 with updated user")
        void withValidRequest_Returns200() throws Exception {
            UpdateUserRequest request = new UpdateUserRequest(null, UserRole.AGENT, false);

            // Target the agent rather than the admin: demoting/disabling the only
            // active admin is correctly refused by the last-admin guard.
            mockMvc.perform(put("/api/users/" + testAgent.getId())
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.role", is("AGENT")))
                    .andExpect(jsonPath("$.enabled", is(false)));
        }

        @Test
        @DisplayName("returns 200 when updating with optional password")
        void withPasswordUpdate_Returns200() throws Exception {
            UpdateUserRequest request = new UpdateUserRequest("newpassword123", UserRole.ADMIN, true);

            mockMvc.perform(put("/api/users/" + testAgent.getId())
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.role", is("ADMIN")))
                    .andExpect(jsonPath("$.enabled", is(true)));
        }

        @Test
        @DisplayName("returns 404 for non-existent ID")
        void withNonExistentId_Returns404() throws Exception {
            UpdateUserRequest request = new UpdateUserRequest(null, UserRole.ADMIN, true);

            mockMvc.perform(put("/api/users/" + UUID.randomUUID())
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("returns 403 for AGENT role")
        void withAgentRole_Returns403() throws Exception {
            UpdateUserRequest request = new UpdateUserRequest(null, UserRole.ADMIN, true);

            mockMvc.perform(put("/api/users/" + testAgent.getId())
                            .header("Authorization", "Bearer " + agentToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("returns 401 without authentication")
        void withoutAuth_Returns401() throws Exception {
            UpdateUserRequest request = new UpdateUserRequest(null, UserRole.ADMIN, true);

            mockMvc.perform(put("/api/users/" + testAgent.getId()).with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnauthorized());
        }
    }

    @Nested
    @DisplayName("DELETE /api/users/{id}")
    class DeleteUser {

        @Test
        @DisplayName("returns 204 for successful deletion")
        void withValidId_Returns204() throws Exception {
            mockMvc.perform(delete("/api/users/" + testAgent.getId())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isNoContent());
        }

        @Test
        @DisplayName("returns 404 for non-existent ID")
        void withNonExistentId_Returns404() throws Exception {
            mockMvc.perform(delete("/api/users/" + UUID.randomUUID())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("returns 401 without authentication")
        void withoutAuth_Returns401() throws Exception {
            mockMvc.perform(delete("/api/users/" + testAgent.getId()).with(csrf()))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("returns 403 for AGENT role")
        void withAgentRole_Returns403() throws Exception {
            mockMvc.perform(delete("/api/users/" + testAgent.getId())
                            .header("Authorization", "Bearer " + agentToken))
                    .andExpect(status().isForbidden());
        }
    }

    @Nested
    @DisplayName("GET /api/users (sortBy validation)")
    class GetAllUsersSortByValidation {

        @Test
        @DisplayName("returns 400 when sortBy is not whitelisted")
        void rejectsInvalidSortBy() throws Exception {
            mockMvc.perform(get("/api/users")
                            .param("page", "0")
                            .param("size", "10")
                            .param("sortBy", "password")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isBadRequest());
        }
    }

    @Nested
    @DisplayName("GET /api/users (sorting)")
    class GetAllUsersSorted {

        @Test
        @DisplayName("returns users sorted descending by username")
        void withDescSort_ReturnsSortedDesc() throws Exception {
            mockMvc.perform(get("/api/users")
                            .param("page", "0")
                            .param("size", "10")
                            .param("sortBy", "username")
                            .param("sortDir", "desc")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[0].username", is("agent")))
                    .andExpect(jsonPath("$.content[1].username", is("admin")));
        }
    }
}
