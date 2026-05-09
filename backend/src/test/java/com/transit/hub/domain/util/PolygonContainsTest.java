package com.transit.hub.domain.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("PolygonContains — ray-cast point-in-polygon on GeoJSON")
class PolygonContainsTest {

    @Nested
    @DisplayName("Polygon")
    class PolygonTests {

        private static final String UNIT_SQUARE = """
                {"type":"Polygon","coordinates":[
                  [[0,0],[1,0],[1,1],[0,1],[0,0]]
                ]}""";

        @Test
        @DisplayName("point well inside the square is contained")
        void insideSquare() {
            assertThat(PolygonContains.contains(UNIT_SQUARE, 0.5, 0.5)).isTrue();
        }

        @Test
        @DisplayName("point well outside the square is rejected")
        void outsideSquare() {
            assertThat(PolygonContains.contains(UNIT_SQUARE, 2.0, 2.0)).isFalse();
            assertThat(PolygonContains.contains(UNIT_SQUARE, -0.1, 0.5)).isFalse();
        }

        @Test
        @DisplayName("respects holes (interior ring) — point inside the hole is rejected")
        void respectsHoles() {
            String donut = """
                    {"type":"Polygon","coordinates":[
                      [[0,0],[10,0],[10,10],[0,10],[0,0]],
                      [[3,3],[7,3],[7,7],[3,7],[3,3]]
                    ]}""";
            assertThat(PolygonContains.contains(donut, 5, 5)).isFalse();
            assertThat(PolygonContains.contains(donut, 1, 1)).isTrue();
            assertThat(PolygonContains.contains(donut, 9, 9)).isTrue();
        }

        @Test
        @DisplayName("rejects malformed JSON without throwing")
        void malformedJson() {
            assertThat(PolygonContains.contains("{not json", 0.5, 0.5)).isFalse();
            assertThat(PolygonContains.contains("", 0.5, 0.5)).isFalse();
            assertThat(PolygonContains.contains(null, 0.5, 0.5)).isFalse();
        }

        @Test
        @DisplayName("rejects rings with fewer than 3 points")
        void degenerateRing() {
            String degenerate = """
                    {"type":"Polygon","coordinates":[[[0,0],[1,1]]]}""";
            assertThat(PolygonContains.contains(degenerate, 0.5, 0.5)).isFalse();
        }
    }

    @Nested
    @DisplayName("MultiPolygon")
    class MultiPolygonTests {

        private static final String TWO_DISJOINT_SQUARES = """
                {"type":"MultiPolygon","coordinates":[
                  [[[0,0],[1,0],[1,1],[0,1],[0,0]]],
                  [[[10,10],[11,10],[11,11],[10,11],[10,10]]]
                ]}""";

        @Test
        @DisplayName("point inside the first polygon is contained")
        void firstPolygon() {
            assertThat(PolygonContains.contains(TWO_DISJOINT_SQUARES, 0.5, 0.5)).isTrue();
        }

        @Test
        @DisplayName("point inside the second polygon is contained")
        void secondPolygon() {
            assertThat(PolygonContains.contains(TWO_DISJOINT_SQUARES, 10.5, 10.5)).isTrue();
        }

        @Test
        @DisplayName("point in the gap between polygons is rejected")
        void betweenPolygons() {
            assertThat(PolygonContains.contains(TWO_DISJOINT_SQUARES, 5.0, 5.0)).isFalse();
        }
    }

    @Nested
    @DisplayName("Unsupported types")
    class UnsupportedTypes {

        @Test
        @DisplayName("LineString returns false rather than crashing")
        void lineStringReturnsFalse() {
            String line = "{\"type\":\"LineString\",\"coordinates\":[[0,0],[1,1]]}";
            assertThat(PolygonContains.contains(line, 0.5, 0.5)).isFalse();
        }

        @Test
        @DisplayName("Point returns false")
        void pointReturnsFalse() {
            String point = "{\"type\":\"Point\",\"coordinates\":[0.5,0.5]}";
            assertThat(PolygonContains.contains(point, 0.5, 0.5)).isFalse();
        }
    }
}
