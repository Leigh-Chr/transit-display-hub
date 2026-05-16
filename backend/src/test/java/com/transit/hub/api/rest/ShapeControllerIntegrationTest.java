package com.transit.hub.api.rest;

import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Shape;
import com.transit.hub.domain.model.ShapePoint;
import com.transit.hub.infrastructure.persistence.ItineraryRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.ShapeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Execution(ExecutionMode.SAME_THREAD)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("ShapeController Integration Tests")
class ShapeControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ItineraryRepository itineraryRepository;
    @Autowired private LineRepository lineRepository;
    @Autowired private ShapeRepository shapeRepository;

    private UUID itineraryWithShapeId;
    private UUID itineraryWithoutShapeId;

    @BeforeEach
    void setUp() {
        itineraryRepository.deleteAll();
        shapeRepository.deleteAll();
        lineRepository.deleteAll();

        Line line = lineRepository.save(Line.builder().code("L1").name("Metro 1").color("#FF0000").build());

        Shape shape = Shape.builder().externalId("SH-1").points(new ArrayList<>()).build();
        ShapePoint p1 = ShapePoint.builder().shape(shape).sequence(0).latitude(45.18).longitude(5.72).build();
        ShapePoint p2 = ShapePoint.builder().shape(shape).sequence(1).latitude(45.19).longitude(5.73).build();
        shape.getPoints().add(p1);
        shape.getPoints().add(p2);
        Shape savedShape = shapeRepository.save(shape);

        Itinerary withShape = Itinerary.builder()
                .line(line).name("Direction East").shape(savedShape)
                .itineraryStops(new ArrayList<>()).build();
        itineraryWithShapeId = itineraryRepository.save(withShape).getId();

        Itinerary withoutShape = Itinerary.builder()
                .line(line).name("Direction West")
                .itineraryStops(new ArrayList<>()).build();
        itineraryWithoutShapeId = itineraryRepository.save(withoutShape).getId();
    }

    @Test
    @DisplayName("returns 200 + the polyline points (public, no auth)")
    void returnsPolyline() throws Exception {
        mockMvc.perform(get("/api/itineraries/{id}/shape", itineraryWithShapeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.externalId", is("SH-1")))
                .andExpect(jsonPath("$.points", hasSize(2)))
                .andExpect(jsonPath("$.points[0].latitude", is(45.18)))
                .andExpect(jsonPath("$.points[0].longitude", is(5.72)));
    }

    @Test
    @DisplayName("returns 204 when the itinerary exists but has no shape attached")
    void returns204WhenNoShape() throws Exception {
        mockMvc.perform(get("/api/itineraries/{id}/shape", itineraryWithoutShapeId))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("returns 404 when the itinerary id is unknown")
    void returns404WhenItineraryUnknown() throws Exception {
        mockMvc.perform(get("/api/itineraries/{id}/shape", UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }
}
