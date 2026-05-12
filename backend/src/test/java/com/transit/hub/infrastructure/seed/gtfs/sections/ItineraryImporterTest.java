package com.transit.hub.infrastructure.seed.gtfs.sections;

import com.transit.hub.domain.model.enums.BikesAllowed;
import com.transit.hub.domain.model.enums.CarsAllowed;
import com.transit.hub.domain.model.enums.WheelchairAccess;
import com.transit.hub.infrastructure.seed.gtfs.model.RouteDirKey;
import com.transit.hub.infrastructure.seed.gtfs.model.TripInfo;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for the pure static helpers on {@link ItineraryImporter}.
 * The full importer is exercised end-to-end by
 * {@code GtfsImportServiceIntegrationTest}; here we only pin the value-only
 * logic that decides how (route, direction)-aggregated accessibility flags
 * collapse into a single itinerary default plus the per-schedule override.
 */
@DisplayName("ItineraryImporter static helpers")
class ItineraryImporterTest {

    private static TripInfo trip(String routeId, String directionId,
                                 int wheelchair, int bikes, int cars) {
        return new TripInfo(routeId, directionId, "S1", "headsign",
                wheelchair, bikes, cars,
                null, null, null, null, null, null);
    }

    private static Map<String, TripInfo> tripsOf(TripInfo... trips) {
        Map<String, TripInfo> map = new HashMap<>();
        for (int i = 0; i < trips.length; i++) {
            map.put("trip-" + i, trips[i]);
        }
        return map;
    }

    @Nested
    @DisplayName("majorityWheelchair")
    class MajorityWheelchair {

        @Test
        @DisplayName("returns ACCESSIBLE when most trips of the (route, direction) are accessible")
        void strictMajorityAccessible() {
            Map<String, TripInfo> trips = tripsOf(
                    trip("R1", "0", 1, 0, 0),
                    trip("R1", "0", 1, 0, 0),
                    trip("R1", "0", 2, 0, 0));
            assertThat(ItineraryImporter.majorityWheelchair(trips, new RouteDirKey("R1", "0")))
                    .isEqualTo(WheelchairAccess.ACCESSIBLE);
        }

        @Test
        @DisplayName("returns NOT_ACCESSIBLE when most trips are not accessible")
        void strictMajorityNotAccessible() {
            Map<String, TripInfo> trips = tripsOf(
                    trip("R1", "0", 2, 0, 0),
                    trip("R1", "0", 2, 0, 0),
                    trip("R1", "0", 1, 0, 0));
            assertThat(ItineraryImporter.majorityWheelchair(trips, new RouteDirKey("R1", "0")))
                    .isEqualTo(WheelchairAccess.NOT_ACCESSIBLE);
        }

        @Test
        @DisplayName("falls back to UNKNOWN on a tie")
        void tieFallsBackToUnknown() {
            Map<String, TripInfo> trips = tripsOf(
                    trip("R1", "0", 1, 0, 0),
                    trip("R1", "0", 2, 0, 0));
            assertThat(ItineraryImporter.majorityWheelchair(trips, new RouteDirKey("R1", "0")))
                    .isEqualTo(WheelchairAccess.UNKNOWN);
        }

        @Test
        @DisplayName("returns UNKNOWN when every trip leaves the value unspecified (code 0)")
        void allUnknown() {
            Map<String, TripInfo> trips = tripsOf(
                    trip("R1", "0", 0, 0, 0),
                    trip("R1", "0", 0, 0, 0));
            assertThat(ItineraryImporter.majorityWheelchair(trips, new RouteDirKey("R1", "0")))
                    .isEqualTo(WheelchairAccess.UNKNOWN);
        }

        @Test
        @DisplayName("returns UNKNOWN when no trip matches the (route, direction)")
        void noMatchingTrips() {
            Map<String, TripInfo> trips = tripsOf(
                    trip("R1", "0", 1, 0, 0),
                    trip("R2", "1", 2, 0, 0));
            // looking up a (route, direction) that is not in the map
            assertThat(ItineraryImporter.majorityWheelchair(trips, new RouteDirKey("R9", "0")))
                    .isEqualTo(WheelchairAccess.UNKNOWN);
        }

        @Test
        @DisplayName("ignores trips from other (route, direction) pairs")
        void filtersOnRouteAndDirection() {
            // R1/0 has 2 NOT-ACCESSIBLE, 1 ACCESSIBLE -> NOT_ACCESSIBLE
            // R1/1 has 2 ACCESSIBLE, 0 NOT-ACCESSIBLE -> ACCESSIBLE
            // R2/0 has 1 NOT-ACCESSIBLE -> NOT_ACCESSIBLE
            Map<String, TripInfo> trips = tripsOf(
                    trip("R1", "0", 2, 0, 0),
                    trip("R1", "0", 2, 0, 0),
                    trip("R1", "0", 1, 0, 0),
                    trip("R1", "1", 1, 0, 0),
                    trip("R1", "1", 1, 0, 0),
                    trip("R2", "0", 2, 0, 0));
            assertThat(ItineraryImporter.majorityWheelchair(trips, new RouteDirKey("R1", "0")))
                    .isEqualTo(WheelchairAccess.NOT_ACCESSIBLE);
            assertThat(ItineraryImporter.majorityWheelchair(trips, new RouteDirKey("R1", "1")))
                    .isEqualTo(WheelchairAccess.ACCESSIBLE);
            assertThat(ItineraryImporter.majorityWheelchair(trips, new RouteDirKey("R2", "0")))
                    .isEqualTo(WheelchairAccess.NOT_ACCESSIBLE);
        }
    }

    @Nested
    @DisplayName("majorityBikes")
    class MajorityBikes {

        @Test
        @DisplayName("returns ALLOWED when bikes are the strict majority")
        void allowed() {
            Map<String, TripInfo> trips = tripsOf(
                    trip("R1", "0", 0, 1, 0),
                    trip("R1", "0", 0, 1, 0),
                    trip("R1", "0", 0, 2, 0));
            assertThat(ItineraryImporter.majorityBikes(trips, new RouteDirKey("R1", "0")))
                    .isEqualTo(BikesAllowed.ALLOWED);
        }

        @Test
        @DisplayName("returns NOT_ALLOWED when bikes are explicitly the majority refusal")
        void notAllowed() {
            Map<String, TripInfo> trips = tripsOf(
                    trip("R1", "0", 0, 2, 0),
                    trip("R1", "0", 0, 2, 0));
            assertThat(ItineraryImporter.majorityBikes(trips, new RouteDirKey("R1", "0")))
                    .isEqualTo(BikesAllowed.NOT_ALLOWED);
        }

        @Test
        @DisplayName("tie collapses to UNKNOWN")
        void tieFallsBackToUnknown() {
            Map<String, TripInfo> trips = tripsOf(
                    trip("R1", "0", 0, 1, 0),
                    trip("R1", "0", 0, 2, 0));
            assertThat(ItineraryImporter.majorityBikes(trips, new RouteDirKey("R1", "0")))
                    .isEqualTo(BikesAllowed.UNKNOWN);
        }

        @Test
        @DisplayName("empty map yields UNKNOWN")
        void empty() {
            assertThat(ItineraryImporter.majorityBikes(Map.of(), new RouteDirKey("R1", "0")))
                    .isEqualTo(BikesAllowed.UNKNOWN);
        }
    }

    @Nested
    @DisplayName("majorityCars")
    class MajorityCars {

        @Test
        @DisplayName("returns ALLOWED when cars are the strict majority (ferry/motorail)")
        void allowed() {
            Map<String, TripInfo> trips = tripsOf(
                    trip("F1", "0", 0, 0, 1),
                    trip("F1", "0", 0, 0, 1));
            assertThat(ItineraryImporter.majorityCars(trips, new RouteDirKey("F1", "0")))
                    .isEqualTo(CarsAllowed.ALLOWED);
        }

        @Test
        @DisplayName("returns NOT_ALLOWED when cars are explicitly refused")
        void notAllowed() {
            Map<String, TripInfo> trips = tripsOf(
                    trip("F1", "0", 0, 0, 2),
                    trip("F1", "0", 0, 0, 2),
                    trip("F1", "0", 0, 0, 1));
            assertThat(ItineraryImporter.majorityCars(trips, new RouteDirKey("F1", "0")))
                    .isEqualTo(CarsAllowed.NOT_ALLOWED);
        }

        @Test
        @DisplayName("returns UNKNOWN when every trip leaves the value blank")
        void allUnknown() {
            Map<String, TripInfo> trips = tripsOf(
                    trip("F1", "0", 0, 0, 0),
                    trip("F1", "0", 0, 0, 0));
            assertThat(ItineraryImporter.majorityCars(trips, new RouteDirKey("F1", "0")))
                    .isEqualTo(CarsAllowed.UNKNOWN);
        }
    }

    @Nested
    @DisplayName("computeWheelchairOverride")
    class ComputeWheelchairOverride {

        @Test
        @DisplayName("empty when the trip flag matches the itinerary default (no schedule row needed)")
        void emptyOnMatch() {
            assertThat(ItineraryImporter.computeWheelchairOverride(1, WheelchairAccess.ACCESSIBLE))
                    .isEmpty();
            assertThat(ItineraryImporter.computeWheelchairOverride(2, WheelchairAccess.NOT_ACCESSIBLE))
                    .isEmpty();
        }

        @Test
        @DisplayName("Boolean.TRUE when the trip is accessible but the default is not")
        void overridesAccessibleAgainstDefault() {
            assertThat(ItineraryImporter.computeWheelchairOverride(1, WheelchairAccess.NOT_ACCESSIBLE))
                    .contains(Boolean.TRUE);
            assertThat(ItineraryImporter.computeWheelchairOverride(1, WheelchairAccess.UNKNOWN))
                    .contains(Boolean.TRUE);
        }

        @Test
        @DisplayName("Boolean.FALSE when the trip is not accessible but the default says it is")
        void overridesNotAccessibleAgainstDefault() {
            assertThat(ItineraryImporter.computeWheelchairOverride(2, WheelchairAccess.ACCESSIBLE))
                    .contains(Boolean.FALSE);
            assertThat(ItineraryImporter.computeWheelchairOverride(2, WheelchairAccess.UNKNOWN))
                    .contains(Boolean.FALSE);
        }

        @Test
        @DisplayName("unknown trip flag (code 0) never produces an override")
        void unknownNeverOverrides() {
            assertThat(ItineraryImporter.computeWheelchairOverride(0, WheelchairAccess.ACCESSIBLE))
                    .isEmpty();
            assertThat(ItineraryImporter.computeWheelchairOverride(0, WheelchairAccess.NOT_ACCESSIBLE))
                    .isEmpty();
            assertThat(ItineraryImporter.computeWheelchairOverride(0, WheelchairAccess.UNKNOWN))
                    .isEmpty();
        }
    }

    @Nested
    @DisplayName("computeBikesOverride")
    class ComputeBikesOverride {

        @Test
        @DisplayName("empty when the trip flag matches the itinerary default")
        void emptyOnMatch() {
            assertThat(ItineraryImporter.computeBikesOverride(1, BikesAllowed.ALLOWED))
                    .isEmpty();
            assertThat(ItineraryImporter.computeBikesOverride(2, BikesAllowed.NOT_ALLOWED))
                    .isEmpty();
        }

        @Test
        @DisplayName("Boolean.TRUE when the trip allows bikes but the default does not")
        void overridesAllowedAgainstDefault() {
            assertThat(ItineraryImporter.computeBikesOverride(1, BikesAllowed.NOT_ALLOWED))
                    .contains(Boolean.TRUE);
            assertThat(ItineraryImporter.computeBikesOverride(1, BikesAllowed.UNKNOWN))
                    .contains(Boolean.TRUE);
        }

        @Test
        @DisplayName("Boolean.FALSE when the trip refuses bikes but the default allows them")
        void overridesNotAllowedAgainstDefault() {
            assertThat(ItineraryImporter.computeBikesOverride(2, BikesAllowed.ALLOWED))
                    .contains(Boolean.FALSE);
            assertThat(ItineraryImporter.computeBikesOverride(2, BikesAllowed.UNKNOWN))
                    .contains(Boolean.FALSE);
        }

        @Test
        @DisplayName("unknown trip flag (code 0) is never an override")
        void unknownNeverOverrides() {
            Optional<Boolean> override = ItineraryImporter.computeBikesOverride(0, BikesAllowed.ALLOWED);
            assertThat(override).isEmpty();
        }
    }

    @Nested
    @DisplayName("buildItineraryName")
    class BuildItineraryName {

        @Test
        @DisplayName("prepends an arrow to a non-blank trip headsign")
        void headsignWins() {
            assertThat(ItineraryImporter.buildItineraryName("Gare de Lyon", "0"))
                    .isEqualTo("→ Gare de Lyon");
        }

        @Test
        @DisplayName("trims surrounding whitespace from the headsign")
        void trimsHeadsign() {
            assertThat(ItineraryImporter.buildItineraryName("  Gare de Lyon  ", "0"))
                    .isEqualTo("→ Gare de Lyon");
        }

        @Test
        @DisplayName("falls back to \"Direction 0\" when the headsign is blank and directionId is 0")
        void fallbackDirectionZero() {
            assertThat(ItineraryImporter.buildItineraryName(null, "0"))
                    .isEqualTo("Direction 0");
            assertThat(ItineraryImporter.buildItineraryName("", "0"))
                    .isEqualTo("Direction 0");
            assertThat(ItineraryImporter.buildItineraryName("   ", "0"))
                    .isEqualTo("Direction 0");
        }

        @Test
        @DisplayName("falls back to \"Direction 1\" for any non-zero direction id")
        void fallbackDirectionNonZero() {
            assertThat(ItineraryImporter.buildItineraryName(null, "1"))
                    .isEqualTo("Direction 1");
            // The helper treats anything that is not the literal "0" as direction 1
            assertThat(ItineraryImporter.buildItineraryName(null, ""))
                    .isEqualTo("Direction 1");
        }
    }
}
