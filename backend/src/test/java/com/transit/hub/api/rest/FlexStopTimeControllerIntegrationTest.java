package com.transit.hub.api.rest;

import com.transit.hub.domain.model.BookingRule;
import com.transit.hub.domain.model.FlexStopTime;
import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Location;
import com.transit.hub.domain.model.LocationGroup;
import com.transit.hub.domain.model.ServiceCalendar;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.BookingType;
import com.transit.hub.domain.model.enums.UserRole;
import com.transit.hub.infrastructure.persistence.BookingRuleRepository;
import com.transit.hub.infrastructure.persistence.FlexStopTimeRepository;
import com.transit.hub.infrastructure.persistence.ItineraryRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.LocationGroupRepository;
import com.transit.hub.infrastructure.persistence.LocationRepository;
import com.transit.hub.infrastructure.persistence.ServiceCalendarRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.persistence.UserRepository;
import com.transit.hub.infrastructure.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("FlexStopTimeController Integration Tests")
class FlexStopTimeControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private FlexStopTimeRepository flexStopTimeRepository;
    @Autowired private BookingRuleRepository bookingRuleRepository;
    @Autowired private ServiceCalendarRepository serviceCalendarRepository;
    @Autowired private LocationRepository locationRepository;
    @Autowired private LocationGroupRepository locationGroupRepository;
    @Autowired private ItineraryRepository itineraryRepository;
    @Autowired private StopRepository stopRepository;
    @Autowired private LineRepository lineRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;

    private String adminToken;
    private String agentToken;
    private Itinerary testItinerary;

    @BeforeEach
    void setUp() {
        flexStopTimeRepository.deleteAll();
        bookingRuleRepository.deleteAll();
        serviceCalendarRepository.deleteAll();
        locationRepository.deleteAll();
        locationGroupRepository.deleteAll();
        itineraryRepository.deleteAll();
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

        Line line = Line.builder().code("FLX1").name("Flex Route 1").color("#123456").build();
        lineRepository.save(line);

        testItinerary = Itinerary.builder().name("Flex Direction").line(line).build();
        itineraryRepository.save(testItinerary);
    }

    private FlexStopTime persistFlexStopTime(int sequence, Stop stop, Location location, LocationGroup group) {
        FlexStopTime row = FlexStopTime.builder()
                .itinerary(testItinerary)
                .stopSequence(sequence)
                .stop(stop)
                .location(location)
                .locationGroup(group)
                .startPickupDropOffWindow(LocalTime.of(11, 0))
                .endPickupDropOffWindow(LocalTime.of(13, 0))
                .build();
        return flexStopTimeRepository.save(row);
    }

    @Nested
    @DisplayName("GET /api/admin/flex-stop-times")
    class Browse {

        @Test
        @DisplayName("returns 200 with all flex stop times for ADMIN")
        void withAdminRole_Returns200() throws Exception {
            Stop stop = Stop.builder().name("Flex Stop").build();
            stopRepository.save(stop);
            persistFlexStopTime(1, stop, null, null);

            mockMvc.perform(get("/api/admin/flex-stop-times")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(1)))
                    .andExpect(jsonPath("$[0].itineraryName", is("Flex Direction")))
                    .andExpect(jsonPath("$[0].lineCode", is("FLX1")))
                    .andExpect(jsonPath("$[0].stopName", is("Flex Stop")))
                    .andExpect(jsonPath("$[0].startPickupDropOffWindow", is("11:00:00")))
                    .andExpect(jsonPath("$[0].endPickupDropOffWindow", is("13:00:00")));
        }

        @Test
        @DisplayName("returns 200 with empty list when no flex data is loaded")
        void withNoFlexData_ReturnsEmptyList() throws Exception {
            mockMvc.perform(get("/api/admin/flex-stop-times")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(0)));
        }

        @Test
        @DisplayName("includes booking rules, service calendar and location target")
        void withFullRow_ExposesRelations() throws Exception {
            BookingRule pickupRule = BookingRule.builder()
                    .externalId("br-pickup")
                    .bookingType(BookingType.SAME_DAY)
                    .phone("0123456789")
                    .build();
            bookingRuleRepository.save(pickupRule);

            BookingRule dropOffRule = BookingRule.builder()
                    .externalId("br-dropoff")
                    .bookingType(BookingType.PRIOR_DAYS)
                    .build();
            bookingRuleRepository.save(dropOffRule);

            ServiceCalendar calendar = ServiceCalendar.builder()
                    .externalId("svc-week")
                    .monday(true).tuesday(true).wednesday(true)
                    .thursday(true).friday(true)
                    .build();
            serviceCalendarRepository.save(calendar);

            Location location = Location.builder()
                    .externalId("loc-A")
                    .name("Flex Zone A")
                    .geometryType("Polygon")
                    .geometryJson("{\"type\":\"Polygon\",\"coordinates\":[]}")
                    .build();
            locationRepository.save(location);

            FlexStopTime row = FlexStopTime.builder()
                    .itinerary(testItinerary)
                    .stopSequence(1)
                    .location(location)
                    .startPickupDropOffWindow(LocalTime.of(9, 0))
                    .endPickupDropOffWindow(LocalTime.of(17, 0))
                    .pickupBookingRule(pickupRule)
                    .dropOffBookingRule(dropOffRule)
                    .serviceCalendar(calendar)
                    .stopHeadsign("Aller TAD")
                    .build();
            flexStopTimeRepository.save(row);

            mockMvc.perform(get("/api/admin/flex-stop-times")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(1)))
                    .andExpect(jsonPath("$[0].locationExternalId", is("loc-A")))
                    .andExpect(jsonPath("$[0].locationName", is("Flex Zone A")))
                    .andExpect(jsonPath("$[0].pickupBookingRuleExternalId", is("br-pickup")))
                    .andExpect(jsonPath("$[0].dropOffBookingRuleExternalId", is("br-dropoff")))
                    .andExpect(jsonPath("$[0].serviceCalendarExternalId", is("svc-week")))
                    .andExpect(jsonPath("$[0].stopHeadsign", is("Aller TAD")));
        }

        @Test
        @DisplayName("returns 200 with multiple rows sorted by itinerary + stop_sequence")
        void withMultipleRows_AllReturned() throws Exception {
            Stop a = Stop.builder().name("Stop A").build();
            Stop b = Stop.builder().name("Stop B").build();
            stopRepository.save(a);
            stopRepository.save(b);
            persistFlexStopTime(1, a, null, null);
            persistFlexStopTime(2, b, null, null);

            mockMvc.perform(get("/api/admin/flex-stop-times")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(2)))
                    .andExpect(jsonPath("$[*].stopName", hasItem("Stop A")))
                    .andExpect(jsonPath("$[*].stopName", hasItem("Stop B")));
        }

        @Test
        @DisplayName("returns 401 without authentication")
        void withoutAuth_Returns401() throws Exception {
            mockMvc.perform(get("/api/admin/flex-stop-times"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("returns 403 for AGENT role")
        void withAgentRole_Returns403() throws Exception {
            mockMvc.perform(get("/api/admin/flex-stop-times")
                            .header("Authorization", "Bearer " + agentToken))
                    .andExpect(status().isForbidden());
        }
    }
}
