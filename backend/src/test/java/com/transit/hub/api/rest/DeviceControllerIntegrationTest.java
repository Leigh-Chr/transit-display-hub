package com.transit.hub.api.rest;

import tools.jackson.databind.ObjectMapper;
import com.transit.hub.application.dto.request.RegisterDeviceRequest;
import com.transit.hub.domain.model.Device;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.DeviceStatus;
import com.transit.hub.domain.model.enums.UserRole;
import com.transit.hub.infrastructure.persistence.DeviceRepository;
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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("DeviceController Integration Tests")
class DeviceControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private DeviceRepository deviceRepository;

    @Autowired
    private StopRepository stopRepository;

    @Autowired
    private LineRepository lineRepository;

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
    private Device testDevice;
    private String plainDeviceToken = "test_device_token";

    @BeforeEach
    void setUp() {
        deviceRepository.deleteAll();
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

        testDevice = Device.builder()
                .tokenLookup(plainDeviceToken.substring(0, 8))
                .tokenHash(passwordEncoder.encode(plainDeviceToken))
                .stop(testStop)
                .status(DeviceStatus.OFFLINE)
                .build();
        deviceRepository.save(testDevice);
    }

    @Nested
    @DisplayName("GET /api/devices")
    class GetAllDevices {

        @Test
        @DisplayName("returns 200 with all devices for ADMIN")
        void withAdminRole_Returns200() throws Exception {
            mockMvc.perform(get("/api/devices")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(1)))
                    .andExpect(jsonPath("$[0].stopName", is("Central Station")));
        }

        @Test
        @DisplayName("returns 401 without authentication")
        void withoutAuth_Returns401() throws Exception {
            mockMvc.perform(get("/api/devices"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("returns 403 for AGENT role")
        void withAgentRole_Returns403() throws Exception {
            mockMvc.perform(get("/api/devices")
                            .header("Authorization", "Bearer " + agentToken))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("filters by status when parameter provided")
        void withStatusFilter_FiltersResults() throws Exception {
            mockMvc.perform(get("/api/devices")
                            .param("status", "OFFLINE")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(1)));

            mockMvc.perform(get("/api/devices")
                            .param("status", "ONLINE")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(0)));
        }
    }

    @Nested
    @DisplayName("GET /api/devices/{id}")
    class GetDevice {

        @Test
        @DisplayName("returns 200 with device for valid ID")
        void withValidId_Returns200() throws Exception {
            mockMvc.perform(get("/api/devices/" + testDevice.getId())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id", is(testDevice.getId().toString())))
                    .andExpect(jsonPath("$.status", is("OFFLINE")));
        }

        @Test
        @DisplayName("returns 404 for non-existent ID")
        void withNonExistentId_Returns404() throws Exception {
            mockMvc.perform(get("/api/devices/" + UUID.randomUUID())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("POST /api/devices")
    class RegisterDevice {

        @Test
        @DisplayName("returns 201 with device and token for ADMIN")
        void withAdminRole_Returns201() throws Exception {
            RegisterDeviceRequest request = new RegisterDeviceRequest(testStop.getId());

            MvcResult result = mockMvc.perform(post("/api/devices")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id", notNullValue()))
                    .andExpect(jsonPath("$.token", notNullValue()))
                    .andExpect(jsonPath("$.token", not(emptyString())))
                    .andExpect(jsonPath("$.stopId", is(testStop.getId().toString())))
                    .andExpect(jsonPath("$.stopName", is("Central Station")))
                    .andReturn();

            // Verify the token is 43 chars (Base64 encoded 32 bytes without padding)
            String responseJson = result.getResponse().getContentAsString();
            String token = objectMapper.readTree(responseJson).get("token").asString();
            assertThat(token).hasSize(43);
        }

        @Test
        @DisplayName("returns 401 without authentication")
        void withoutAuth_Returns401() throws Exception {
            RegisterDeviceRequest request = new RegisterDeviceRequest(testStop.getId());

            mockMvc.perform(post("/api/devices").with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("returns 403 for AGENT role")
        void withAgentRole_Returns403() throws Exception {
            RegisterDeviceRequest request = new RegisterDeviceRequest(testStop.getId());

            mockMvc.perform(post("/api/devices")
                            .header("Authorization", "Bearer " + agentToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("returns 404 for non-existent stop")
        void withNonExistentStop_Returns404() throws Exception {
            RegisterDeviceRequest request = new RegisterDeviceRequest(UUID.randomUUID());

            mockMvc.perform(post("/api/devices")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isNotFound());
        }

    }

    @Nested
    @DisplayName("PUT /api/devices/{id}")
    class UpdateDevice {

        @Test
        @DisplayName("returns 200 with updated device")
        void withValidRequest_Returns200() throws Exception {
            Stop newStop = Stop.builder()
                    .name("New Station")
                    .lines(java.util.Set.of(testLine))
                    .build();
            stopRepository.save(newStop);

            RegisterDeviceRequest request = new RegisterDeviceRequest(newStop.getId());

            mockMvc.perform(put("/api/devices/" + testDevice.getId())
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.stopId", is(newStop.getId().toString())))
                    .andExpect(jsonPath("$.stopName", is("New Station")));
        }

        @Test
        @DisplayName("returns 404 for non-existent device")
        void withNonExistentDevice_Returns404() throws Exception {
            RegisterDeviceRequest request = new RegisterDeviceRequest(testStop.getId());

            mockMvc.perform(put("/api/devices/" + UUID.randomUUID())
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("returns 404 for non-existent stop")
        void withNonExistentStop_Returns404() throws Exception {
            RegisterDeviceRequest request = new RegisterDeviceRequest(UUID.randomUUID());

            mockMvc.perform(put("/api/devices/" + testDevice.getId())
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("DELETE /api/devices/{id}")
    class DeleteDevice {

        @Test
        @DisplayName("returns 204 for successful deletion")
        void withValidId_Returns204() throws Exception {
            mockMvc.perform(delete("/api/devices/" + testDevice.getId())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isNoContent());

            assertThat(deviceRepository.findById(testDevice.getId())).isEmpty();
        }

        @Test
        @DisplayName("returns 404 for non-existent ID")
        void withNonExistentId_Returns404() throws Exception {
            mockMvc.perform(delete("/api/devices/" + UUID.randomUUID())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("returns 401 without authentication")
        void withoutAuth_Returns401() throws Exception {
            mockMvc.perform(delete("/api/devices/" + testDevice.getId()).with(csrf()))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("returns 403 for AGENT role")
        void withAgentRole_Returns403() throws Exception {
            mockMvc.perform(delete("/api/devices/" + testDevice.getId())
                            .header("Authorization", "Bearer " + agentToken))
                    .andExpect(status().isForbidden());
        }
    }
}
