package com.transit.hub.domain.model;

import com.transit.hub.testutil.TestDataFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Itinerary")
class ItineraryTest {

    private Line line;
    private Stop stopA;
    private Stop stopB;
    private Stop stopC;

    @BeforeEach
    void setUp() {
        line = TestDataFactory.createLine("L1", "Metro Line 1", "#FF5733");
        stopA = TestDataFactory.createStop("Station A", line);
        stopB = TestDataFactory.createStop("Station B", line);
        stopC = TestDataFactory.createStop("Station C", line);
    }

    @Nested
    @DisplayName("getTerminusName")
    class GetTerminusName {

        @Test
        @DisplayName("returns last stop name when stops exist")
        void withStops_ReturnsLastStopName() {
            Itinerary itinerary = TestDataFactory.createItineraryWithStops(line, "Direction North", stopA, stopB, stopC);

            assertThat(itinerary.getTerminusName()).isEqualTo("Station C");
        }

        @Test
        @DisplayName("returns null when itinerary has no stops")
        void withNoStops_ReturnsNull() {
            Itinerary itinerary = TestDataFactory.createItinerary(line, "Empty Itinerary");

            assertThat(itinerary.getTerminusName()).isNull();
        }

        @Test
        @DisplayName("returns single stop name when only one stop")
        void withSingleStop_ReturnsThatStopName() {
            Itinerary itinerary = TestDataFactory.createItineraryWithStops(line, "Short Route", stopA);

            assertThat(itinerary.getTerminusName()).isEqualTo("Station A");
        }
    }

    @Nested
    @DisplayName("addStop")
    class AddStop {

        @Test
        @DisplayName("adds stop with correct position")
        void addsStopWithPosition() {
            Itinerary itinerary = TestDataFactory.createItinerary(line, "Test Route");

            itinerary.addStop(stopA, 0);

            assertThat(itinerary.getItineraryStops()).hasSize(1);
            assertThat(itinerary.getItineraryStops().getFirst().getStop()).isEqualTo(stopA);
            assertThat(itinerary.getItineraryStops().getFirst().getPosition()).isEqualTo(0);
        }

        @Test
        @DisplayName("adds multiple stops preserving positions")
        void addsMultipleStops() {
            Itinerary itinerary = TestDataFactory.createItinerary(line, "Test Route");

            itinerary.addStop(stopA, 0);
            itinerary.addStop(stopB, 1);
            itinerary.addStop(stopC, 2);

            assertThat(itinerary.getItineraryStops()).hasSize(3);
            assertThat(itinerary.getItineraryStops().get(0).getStop()).isEqualTo(stopA);
            assertThat(itinerary.getItineraryStops().get(1).getStop()).isEqualTo(stopB);
            assertThat(itinerary.getItineraryStops().get(2).getStop()).isEqualTo(stopC);
        }

        @Test
        @DisplayName("sets itinerary reference on the created ItineraryStop")
        void setsItineraryReference() {
            Itinerary itinerary = TestDataFactory.createItinerary(line, "Test Route");

            itinerary.addStop(stopA, 0);

            assertThat(itinerary.getItineraryStops().getFirst().getItinerary()).isEqualTo(itinerary);
        }
    }

    @Nested
    @DisplayName("removeStop")
    class RemoveStop {

        @Test
        @DisplayName("removes the specified stop")
        void removesStop() {
            Itinerary itinerary = TestDataFactory.createItineraryWithStops(line, "Test Route", stopA, stopB, stopC);

            itinerary.removeStop(stopB);

            assertThat(itinerary.getItineraryStops()).hasSize(2);
            assertThat(itinerary.getItineraryStops().stream()
                    .map(is -> is.getStop().getName())
                    .toList()).containsExactly("Station A", "Station C");
        }

        @Test
        @DisplayName("reorders remaining stops after removal")
        void reordersAfterRemoval() {
            Itinerary itinerary = TestDataFactory.createItineraryWithStops(line, "Test Route", stopA, stopB, stopC);

            itinerary.removeStop(stopA);

            assertThat(itinerary.getItineraryStops()).hasSize(2);
            assertThat(itinerary.getItineraryStops().get(0).getPosition()).isEqualTo(0);
            assertThat(itinerary.getItineraryStops().get(1).getPosition()).isEqualTo(1);
            assertThat(itinerary.getItineraryStops().get(0).getStop()).isEqualTo(stopB);
            assertThat(itinerary.getItineraryStops().get(1).getStop()).isEqualTo(stopC);
        }

        @Test
        @DisplayName("handles removal of middle stop correctly")
        void removesMiddleStop() {
            Itinerary itinerary = TestDataFactory.createItineraryWithStops(line, "Test Route", stopA, stopB, stopC);

            itinerary.removeStop(stopB);

            assertThat(itinerary.getItineraryStops()).hasSize(2);
            assertThat(itinerary.getItineraryStops().get(0).getPosition()).isEqualTo(0);
            assertThat(itinerary.getItineraryStops().get(0).getStop()).isEqualTo(stopA);
            assertThat(itinerary.getItineraryStops().get(1).getPosition()).isEqualTo(1);
            assertThat(itinerary.getItineraryStops().get(1).getStop()).isEqualTo(stopC);
        }

        @Test
        @DisplayName("does nothing when stop is not in itinerary")
        void stopNotInItinerary_DoesNothing() {
            Itinerary itinerary = TestDataFactory.createItineraryWithStops(line, "Test Route", stopA, stopB);
            Stop unknownStop = TestDataFactory.createStop("Unknown Station", line);

            itinerary.removeStop(unknownStop);

            assertThat(itinerary.getItineraryStops()).hasSize(2);
        }
    }

    @Nested
    @DisplayName("clearStops")
    class ClearStops {

        @Test
        @DisplayName("removes all stops from itinerary")
        void removesAllStops() {
            Itinerary itinerary = TestDataFactory.createItineraryWithStops(line, "Test Route", stopA, stopB, stopC);

            assertThat(itinerary.getItineraryStops()).hasSize(3);

            itinerary.clearStops();

            assertThat(itinerary.getItineraryStops()).isEmpty();
        }

        @Test
        @DisplayName("is safe to call on empty itinerary")
        void onEmptyItinerary_DoesNothing() {
            Itinerary itinerary = TestDataFactory.createItinerary(line, "Empty Route");

            itinerary.clearStops();

            assertThat(itinerary.getItineraryStops()).isEmpty();
        }
    }
}
