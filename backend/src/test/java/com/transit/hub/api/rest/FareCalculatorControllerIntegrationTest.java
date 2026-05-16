package com.transit.hub.api.rest;

import com.transit.hub.domain.model.Area;
import com.transit.hub.domain.model.FareAttribute;
import com.transit.hub.domain.model.FareLegRule;
import com.transit.hub.domain.model.FareProduct;
import com.transit.hub.domain.model.FareRule;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.FarePaymentMethod;
import com.transit.hub.infrastructure.persistence.AreaRepository;
import com.transit.hub.infrastructure.persistence.FareAttributeRepository;
import com.transit.hub.infrastructure.persistence.FareLegRuleRepository;
import com.transit.hub.infrastructure.persistence.FareProductRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Execution(ExecutionMode.SAME_THREAD)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("FareCalculatorController Integration Tests")
class FareCalculatorControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private StopRepository stopRepository;
    @Autowired private LineRepository lineRepository;
    @Autowired private FareAttributeRepository fareAttributeRepository;
    @Autowired private FareLegRuleRepository fareLegRuleRepository;
    @Autowired private FareProductRepository fareProductRepository;
    @Autowired private AreaRepository areaRepository;

    private Stop fromStop;
    private Stop toStop;

    @BeforeEach
    void setUp() {
        fareLegRuleRepository.deleteAll();
        fareProductRepository.deleteAll();
        areaRepository.deleteAll();
        fareAttributeRepository.deleteAll();
        stopRepository.deleteAll();
        lineRepository.deleteAll();

        Line line = Line.builder().code("L1").name("Metro Line 1").color("#FF5733").build();
        lineRepository.save(line);

        fromStop = Stop.builder()
                .name("Origin Station")
                .zoneId("zoneA")
                .lines(new HashSet<>(Set.of(line)))
                .build();
        stopRepository.save(fromStop);

        toStop = Stop.builder()
                .name("Destination Station")
                .zoneId("zoneB")
                .lines(new HashSet<>(Set.of(line)))
                .build();
        stopRepository.save(toStop);

        // Seed a v1 fare matching the (zoneA -> zoneB) trip
        FareAttribute attr = FareAttribute.builder()
                .externalId("single-ride")
                .price(new BigDecimal("1.80"))
                .currency("EUR")
                .paymentMethod(FarePaymentMethod.PREPAID)
                .transfers(1)
                .build();
        fareAttributeRepository.save(attr);
        FareRule rule = FareRule.builder()
                .fareAttribute(attr)
                .originId("zoneA")
                .destinationId("zoneB")
                .build();
        attr.getRules().add(rule);
        fareAttributeRepository.save(attr);

        // Seed a v2 fare: an area covering each stop + a leg rule
        Area fromArea = Area.builder()
                .externalId("area-from")
                .name("From Area")
                .stops(new HashSet<>(Set.of(fromStop)))
                .build();
        areaRepository.save(fromArea);
        Area toArea = Area.builder()
                .externalId("area-to")
                .name("To Area")
                .stops(new HashSet<>(Set.of(toStop)))
                .build();
        areaRepository.save(toArea);

        FareProduct product = FareProduct.builder()
                .externalId("product-1")
                .name("Single Trip")
                .amount(new BigDecimal("2.00"))
                .currency("EUR")
                .build();
        fareProductRepository.save(product);

        FareLegRule legRule = FareLegRule.builder()
                .legGroupId("leg-1")
                .fromArea(fromArea)
                .toArea(toArea)
                .fareProduct(product)
                .rulePriority(1)
                .build();
        fareLegRuleRepository.save(legRule);
    }

    @Nested
    @DisplayName("GET /api/fares/calculate")
    class Calculate {

        @Test
        @DisplayName("returns 200 with V1 + V2 options when both stops exist (public endpoint)")
        void withValidStops_Returns200WithOptions() throws Exception {
            mockMvc.perform(get("/api/fares/calculate")
                            .param("from", fromStop.getId().toString())
                            .param("to", toStop.getId().toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.fromStopId", is(fromStop.getId().toString())))
                    .andExpect(jsonPath("$.fromStopName", is("Origin Station")))
                    .andExpect(jsonPath("$.fromZoneId", is("zoneA")))
                    .andExpect(jsonPath("$.toStopId", is(toStop.getId().toString())))
                    .andExpect(jsonPath("$.toStopName", is("Destination Station")))
                    .andExpect(jsonPath("$.toZoneId", is("zoneB")))
                    .andExpect(jsonPath("$.v1", hasSize(greaterThanOrEqualTo(1))))
                    .andExpect(jsonPath("$.v1[0].fareId", is("single-ride")))
                    .andExpect(jsonPath("$.v1[0].currency", is("EUR")))
                    .andExpect(jsonPath("$.v2", hasSize(1)))
                    .andExpect(jsonPath("$.v2[0].fareProductId", is("product-1")))
                    .andExpect(jsonPath("$.v2[0].amount", is(2.00)));
        }

        @Test
        @DisplayName("returns 200 without authentication (endpoint is public)")
        void withoutAuth_Returns200() throws Exception {
            mockMvc.perform(get("/api/fares/calculate")
                            .param("from", fromStop.getId().toString())
                            .param("to", toStop.getId().toString()))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("returns 404 when the origin stop is unknown")
        void withUnknownFromStop_Returns404() throws Exception {
            mockMvc.perform(get("/api/fares/calculate")
                            .param("from", UUID.randomUUID().toString())
                            .param("to", toStop.getId().toString()))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("returns 404 when the destination stop is unknown")
        void withUnknownToStop_Returns404() throws Exception {
            mockMvc.perform(get("/api/fares/calculate")
                            .param("from", fromStop.getId().toString())
                            .param("to", UUID.randomUUID().toString()))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("returns 400 when the from parameter is missing")
        void missingFromParam_Returns400() throws Exception {
            mockMvc.perform(get("/api/fares/calculate")
                            .param("to", toStop.getId().toString()))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 400 when the from parameter is not a valid UUID")
        void invalidUuidParam_Returns400() throws Exception {
            mockMvc.perform(get("/api/fares/calculate")
                            .param("from", "not-a-uuid")
                            .param("to", toStop.getId().toString()))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 200 with empty V1 and V2 when stops carry no fare data")
        void withoutFareData_ReturnsEmptyOptions() throws Exception {
            // A pair of stops with no zone_id and no area membership
            Stop a = Stop.builder().name("Bare Stop A").build();
            stopRepository.save(a);
            Stop b = Stop.builder().name("Bare Stop B").build();
            stopRepository.save(b);

            mockMvc.perform(get("/api/fares/calculate")
                            .param("from", a.getId().toString())
                            .param("to", b.getId().toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.v1", hasSize(0)))
                    .andExpect(jsonPath("$.v2", hasSize(0)));
        }
    }
}
