package com.transit.hub.api.rest;

import tools.jackson.databind.ObjectMapper;
import com.transit.hub.application.dto.request.CreateMessageRequest;
import com.transit.hub.domain.model.BroadcastMessage;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.domain.model.enums.MessageSeverity;
import com.transit.hub.domain.model.enums.UserRole;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.persistence.UserRepository;
import com.transit.hub.infrastructure.security.JwtService;
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

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("MessageController Integration Tests")
class MessageControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private BroadcastMessageRepository messageRepository;

    @Autowired
    private LineRepository lineRepository;

    @Autowired
    private StopRepository stopRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    private String adminToken;
    private String agentToken;
    private Line testLine;
    private Stop testStop;
    private BroadcastMessage testMessage;
    private Instant now;
    private Instant futureTime;

    @BeforeEach
    void setUp() {
        messageRepository.deleteAll();
        stopRepository.deleteAll();
        lineRepository.deleteAll();
        userRepository.deleteAll();

        User admin = User.builder()
                .username("admin")
                .password(passwordEncoder.encode("admin123"))
                .role(UserRole.ADMIN)
                .enabled(true)
                .build();
        userRepository.save(admin);
        adminToken = jwtService.generateToken(admin);

        User agent = User.builder()
                .username("agent")
                .password(passwordEncoder.encode("agent123"))
                .role(UserRole.AGENT)
                .enabled(true)
                .build();
        userRepository.save(agent);
        agentToken = jwtService.generateToken(agent);

        testLine = Line.builder()
                .code("L1")
                .name("Metro Line 1")
                .color("#FF5733")
                .build();
        lineRepository.save(testLine);

        testStop = Stop.builder()
                .name("Central Station")
                .lines(java.util.Set.of(testLine))
                .build();
        stopRepository.save(testStop);

        now = Instant.now();
        futureTime = now.plus(1, ChronoUnit.HOURS);

        testMessage = BroadcastMessage.builder()
                .title("Test Alert")
                .content("Test content")
                .severity(MessageSeverity.INFO)
                .startTime(now.minus(1, ChronoUnit.HOURS))
                .endTime(futureTime)
                .scopeType(MessageScope.NETWORK)
                .scopeId(null)
                .build();
        messageRepository.save(testMessage);
    }

    @Nested
    @DisplayName("GET /api/messages")
    class GetAllMessages {

        @Test
        @DisplayName("returns 200 with all messages for ADMIN")
        void withAdminRole_Returns200() throws Exception {
            mockMvc.perform(get("/api/messages")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(1)))
                    .andExpect(jsonPath("$[0].title", is("Test Alert")));
        }

        @Test
        @DisplayName("returns 200 with all messages for AGENT (both roles allowed)")
        void withAgentRole_Returns200() throws Exception {
            mockMvc.perform(get("/api/messages")
                            .header("Authorization", "Bearer " + agentToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(1)));
        }

        @Test
        @DisplayName("returns 403 without authentication")
        void withoutAuth_Returns403() throws Exception {
            mockMvc.perform(get("/api/messages"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("returns only active messages when active=true")
        void withActiveFilter_ReturnsOnlyActive() throws Exception {
            // Add an inactive message
            BroadcastMessage inactiveMessage = BroadcastMessage.builder()
                    .title("Past Alert")
                    .content("Expired")
                    .severity(MessageSeverity.INFO)
                    .startTime(now.minus(2, ChronoUnit.HOURS))
                    .endTime(now.minus(1, ChronoUnit.HOURS))
                    .scopeType(MessageScope.NETWORK)
                    .build();
            messageRepository.save(inactiveMessage);

            mockMvc.perform(get("/api/messages")
                            .param("active", "true")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(1)))
                    .andExpect(jsonPath("$[0].title", is("Test Alert")));
        }
    }

    @Nested
    @DisplayName("POST /api/messages")
    class CreateMessage {

        @Test
        @DisplayName("returns 201 with NETWORK scope message for ADMIN")
        void withNetworkScope_Returns201() throws Exception {
            CreateMessageRequest request = new CreateMessageRequest(
                    "New Alert",
                    "New content",
                    MessageSeverity.WARNING,
                    now,
                    futureTime,
                    MessageScope.NETWORK,
                    null
            );

            mockMvc.perform(post("/api/messages")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.title", is("New Alert")))
                    .andExpect(jsonPath("$.scopeType", is("NETWORK")))
                    .andExpect(jsonPath("$.scopeId", nullValue()));
        }

        @Test
        @DisplayName("returns 201 with LINE scope message for AGENT")
        void withLineScopeAndAgent_Returns201() throws Exception {
            CreateMessageRequest request = new CreateMessageRequest(
                    "Line Alert",
                    "Line content",
                    MessageSeverity.INFO,
                    now,
                    futureTime,
                    MessageScope.LINE,
                    testLine.getId()
            );

            mockMvc.perform(post("/api/messages")
                            .header("Authorization", "Bearer " + agentToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.scopeType", is("LINE")))
                    .andExpect(jsonPath("$.scopeId", is(testLine.getId().toString())));
        }

        @Test
        @DisplayName("returns 201 with STOP scope message")
        void withStopScope_Returns201() throws Exception {
            CreateMessageRequest request = new CreateMessageRequest(
                    "Stop Alert",
                    "Stop content",
                    MessageSeverity.CRITICAL,
                    now,
                    futureTime,
                    MessageScope.STOP,
                    testStop.getId()
            );

            mockMvc.perform(post("/api/messages")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.scopeType", is("STOP")))
                    .andExpect(jsonPath("$.scopeId", is(testStop.getId().toString())));
        }

        @Test
        @DisplayName("returns 400 for NETWORK scope with scopeId")
        void networkScopeWithScopeId_Returns400() throws Exception {
            CreateMessageRequest request = new CreateMessageRequest(
                    "Invalid",
                    "Content",
                    MessageSeverity.INFO,
                    now,
                    futureTime,
                    MessageScope.NETWORK,
                    UUID.randomUUID()
            );

            mockMvc.perform(post("/api/messages")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 400 for LINE scope without scopeId")
        void lineScopeWithoutScopeId_Returns400() throws Exception {
            CreateMessageRequest request = new CreateMessageRequest(
                    "Invalid",
                    "Content",
                    MessageSeverity.INFO,
                    now,
                    futureTime,
                    MessageScope.LINE,
                    null
            );

            mockMvc.perform(post("/api/messages")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 400 for STOP scope without scopeId")
        void stopScopeWithoutScopeId_Returns400() throws Exception {
            CreateMessageRequest request = new CreateMessageRequest(
                    "Invalid",
                    "Content",
                    MessageSeverity.INFO,
                    now,
                    futureTime,
                    MessageScope.STOP,
                    null
            );

            mockMvc.perform(post("/api/messages")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 400 when startTime is after endTime")
        void startTimeAfterEndTime_Returns400() throws Exception {
            CreateMessageRequest request = new CreateMessageRequest(
                    "Invalid",
                    "Content",
                    MessageSeverity.INFO,
                    now.plus(2, ChronoUnit.HOURS),
                    now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK,
                    null
            );

            mockMvc.perform(post("/api/messages")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 404 for LINE scope with non-existent lineId")
        void lineScopeWithNonExistentLine_Returns404() throws Exception {
            CreateMessageRequest request = new CreateMessageRequest(
                    "Alert",
                    "Content",
                    MessageSeverity.INFO,
                    now,
                    futureTime,
                    MessageScope.LINE,
                    UUID.randomUUID()
            );

            mockMvc.perform(post("/api/messages")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("returns 404 for STOP scope with non-existent stopId")
        void stopScopeWithNonExistentStop_Returns404() throws Exception {
            CreateMessageRequest request = new CreateMessageRequest(
                    "Alert",
                    "Content",
                    MessageSeverity.INFO,
                    now,
                    futureTime,
                    MessageScope.STOP,
                    UUID.randomUUID()
            );

            mockMvc.perform(post("/api/messages")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("returns 403 without authentication")
        void withoutAuth_Returns403() throws Exception {
            CreateMessageRequest request = new CreateMessageRequest(
                    "Alert", "Content", MessageSeverity.INFO, now, futureTime, MessageScope.NETWORK, null
            );

            mockMvc.perform(post("/api/messages")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isForbidden());
        }
    }

    @Nested
    @DisplayName("GET /api/messages/{id}")
    class GetMessage {

        @Test
        @DisplayName("returns 200 with message for valid ID")
        void withValidId_Returns200() throws Exception {
            mockMvc.perform(get("/api/messages/" + testMessage.getId())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id", is(testMessage.getId().toString())))
                    .andExpect(jsonPath("$.title", is("Test Alert")));
        }

        @Test
        @DisplayName("returns 404 for non-existent ID")
        void withNonExistentId_Returns404() throws Exception {
            mockMvc.perform(get("/api/messages/" + UUID.randomUUID())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("PUT /api/messages/{id}")
    class UpdateMessage {

        @Test
        @DisplayName("returns 200 with updated message")
        void withValidRequest_Returns200() throws Exception {
            CreateMessageRequest request = new CreateMessageRequest(
                    "Updated Title",
                    "Updated content",
                    MessageSeverity.CRITICAL,
                    now,
                    futureTime,
                    MessageScope.NETWORK,
                    null
            );

            mockMvc.perform(put("/api/messages/" + testMessage.getId())
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.title", is("Updated Title")))
                    .andExpect(jsonPath("$.severity", is("CRITICAL")));
        }

        @Test
        @DisplayName("returns 404 for non-existent ID")
        void withNonExistentId_Returns404() throws Exception {
            CreateMessageRequest request = new CreateMessageRequest(
                    "Title", "Content", MessageSeverity.INFO, now, futureTime, MessageScope.NETWORK, null
            );

            mockMvc.perform(put("/api/messages/" + UUID.randomUUID())
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("DELETE /api/messages/{id}")
    class DeleteMessage {

        @Test
        @DisplayName("returns 204 for successful deletion")
        void withValidId_Returns204() throws Exception {
            mockMvc.perform(delete("/api/messages/" + testMessage.getId())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isNoContent());
        }

        @Test
        @DisplayName("returns 404 for non-existent ID")
        void withNonExistentId_Returns404() throws Exception {
            mockMvc.perform(delete("/api/messages/" + UUID.randomUUID())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isNotFound());
        }
    }
}
