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
    @DisplayName("addItineraryStop")
    class AddItineraryStop {

        @Test
        @DisplayName("adds stop with provided position")
        void addsStopWithPosition() {
            Itinerary itinerary = TestDataFactory.createItinerary(line, "Test Route");

            itinerary.addItineraryStop(ItineraryStop.builder().stop(stopA).position(0).build());

            assertThat(itinerary.getItineraryStops()).hasSize(1);
            assertThat(itinerary.getItineraryStops().getFirst().getStop()).isEqualTo(stopA);
            assertThat(itinerary.getItineraryStops().getFirst().getPosition()).isEqualTo(0);
        }

        @Test
        @DisplayName("adds multiple stops preserving positions")
        void addsMultipleStops() {
            Itinerary itinerary = TestDataFactory.createItinerary(line, "Test Route");

            itinerary.addItineraryStop(ItineraryStop.builder().stop(stopA).position(0).build());
            itinerary.addItineraryStop(ItineraryStop.builder().stop(stopB).position(1).build());
            itinerary.addItineraryStop(ItineraryStop.builder().stop(stopC).position(2).build());

            assertThat(itinerary.getItineraryStops()).hasSize(3);
            assertThat(itinerary.getItineraryStops().get(0).getStop()).isEqualTo(stopA);
            assertThat(itinerary.getItineraryStops().get(1).getStop()).isEqualTo(stopB);
            assertThat(itinerary.getItineraryStops().get(2).getStop()).isEqualTo(stopC);
        }

        @Test
        @DisplayName("sets the back-reference on the added ItineraryStop")
        void setsItineraryReference() {
            Itinerary itinerary = TestDataFactory.createItinerary(line, "Test Route");

            ItineraryStop is = ItineraryStop.builder().stop(stopA).position(0).build();
            itinerary.addItineraryStop(is);

            assertThat(is.getItinerary()).isEqualTo(itinerary);
            assertThat(itinerary.getItineraryStops().getFirst().getItinerary()).isEqualTo(itinerary);
        }
    }

    @Nested
    @DisplayName("removeItineraryStopIf")
    class RemoveItineraryStopIf {

        @Test
        @DisplayName("removes the matching stop and reports the change")
        void removesMatchingStop() {
            Itinerary itinerary = TestDataFactory.createItineraryWithStops(line, "Test Route", stopA, stopB, stopC);

            boolean removed = itinerary.removeItineraryStopIf(is -> is.getStop().equals(stopB));

            assertThat(removed).isTrue();
            assertThat(itinerary.getItineraryStops()).hasSize(2);
            assertThat(itinerary.getItineraryStops().stream()
                    .map(is -> is.getStop().getName())
                    .toList()).containsExactly("Station A", "Station C");
        }

        @Test
        @DisplayName("returns false when no stop matches")
        void noMatch_ReturnsFalse() {
            Itinerary itinerary = TestDataFactory.createItineraryWithStops(line, "Test Route", stopA, stopB);
            Stop unknownStop = TestDataFactory.createStop("Unknown Station", line);

            boolean removed = itinerary.removeItineraryStopIf(is -> is.getStop().equals(unknownStop));

            assertThat(removed).isFalse();
            assertThat(itinerary.getItineraryStops()).hasSize(2);
        }

        @Test
        @DisplayName("detaches the removed stop from this itinerary")
        void detachesRemovedStop() {
            Itinerary itinerary = TestDataFactory.createItineraryWithStops(line, "Test Route", stopA, stopB);
            ItineraryStop toRemove = itinerary.getItineraryStops().getFirst();

            itinerary.removeItineraryStopIf(is -> is.getStop().equals(stopA));

            assertThat(toRemove.getItinerary()).isNull();
        }
    }

    @Nested
    @DisplayName("clearItineraryStops")
    class ClearItineraryStops {

        @Test
        @DisplayName("removes all stops from itinerary")
        void removesAllStops() {
            Itinerary itinerary = TestDataFactory.createItineraryWithStops(line, "Test Route", stopA, stopB, stopC);

            assertThat(itinerary.getItineraryStops()).hasSize(3);

            itinerary.clearItineraryStops();

            assertThat(itinerary.getItineraryStops()).isEmpty();
        }

        @Test
        @DisplayName("is safe to call on empty itinerary")
        void onEmptyItinerary_DoesNothing() {
            Itinerary itinerary = TestDataFactory.createItinerary(line, "Empty Route");

            itinerary.clearItineraryStops();

            assertThat(itinerary.getItineraryStops()).isEmpty();
        }
    }
}
