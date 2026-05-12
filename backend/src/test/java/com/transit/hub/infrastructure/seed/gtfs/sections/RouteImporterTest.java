package com.transit.hub.infrastructure.seed.gtfs.sections;

import com.transit.hub.domain.model.Agency;
import com.transit.hub.domain.model.enums.LineType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for the package-private helpers on {@link RouteImporter}.
 * The orchestration around the {@code LineRepository} is covered by
 * {@code GtfsImportServiceIntegrationTest}; we only pin the value-only
 * mapping from {@link LineType} to its human-readable label and the
 * agency-resolution fallback used by single-agency feeds.
 */
@DisplayName("RouteImporter static helpers")
class RouteImporterTest {

    private static Agency agencyNamed(String name) {
        Agency a = new Agency();
        a.setName(name);
        return a;
    }

    @Nested
    @DisplayName("routeTypeLabel")
    class RouteTypeLabel {

        @Test
        @DisplayName("returns the human-readable label for each LineType")
        void coversEveryEnumConstant() {
            assertThat(RouteImporter.routeTypeLabel(LineType.TRAM)).isEqualTo("Tram");
            assertThat(RouteImporter.routeTypeLabel(LineType.METRO)).isEqualTo("Metro");
            assertThat(RouteImporter.routeTypeLabel(LineType.TRAIN)).isEqualTo("Train");
            assertThat(RouteImporter.routeTypeLabel(LineType.BUS)).isEqualTo("Bus");
            assertThat(RouteImporter.routeTypeLabel(LineType.FERRY)).isEqualTo("Ferry");
            assertThat(RouteImporter.routeTypeLabel(LineType.FUNICULAR)).isEqualTo("Funicular");
            assertThat(RouteImporter.routeTypeLabel(LineType.CABLE_CAR)).isEqualTo("Cable car");
            assertThat(RouteImporter.routeTypeLabel(LineType.TROLLEYBUS)).isEqualTo("Trolleybus");
            assertThat(RouteImporter.routeTypeLabel(LineType.MONORAIL)).isEqualTo("Monorail");
            assertThat(RouteImporter.routeTypeLabel(LineType.OTHER)).isEqualTo("Other");
        }

        @Test
        @DisplayName("returns \"Bus\" when the type is null (defensive)")
        void nullFallsBackToBus() {
            assertThat(RouteImporter.routeTypeLabel(null)).isEqualTo("Bus");
        }
    }

    @Nested
    @DisplayName("resolveAgency")
    class ResolveAgency {

        @Test
        @DisplayName("returns null when the agency index is empty")
        void emptyIndexYieldsNull() {
            assertThat(RouteImporter.resolveAgency("AG-1", Map.of())).isNull();
            assertThat(RouteImporter.resolveAgency(null, Map.of())).isNull();
            assertThat(RouteImporter.resolveAgency("", Map.of())).isNull();
        }

        @Test
        @DisplayName("returns the matching agency when the GTFS agency_id is provided")
        void matchesById() {
            Agency tcl = agencyNamed("TCL");
            Agency star = agencyNamed("STAR");
            Map<String, Agency> agencies = new LinkedHashMap<>();
            agencies.put("tcl", tcl);
            agencies.put("star", star);
            assertThat(RouteImporter.resolveAgency("tcl", agencies)).isSameAs(tcl);
            assertThat(RouteImporter.resolveAgency("star", agencies)).isSameAs(star);
        }

        @Test
        @DisplayName("trims surrounding whitespace from agency_id before matching")
        void trimsAgencyId() {
            Agency a = agencyNamed("A");
            Map<String, Agency> agencies = Map.of("ag-1", a);
            assertThat(RouteImporter.resolveAgency("  ag-1  ", agencies)).isSameAs(a);
        }

        @Test
        @DisplayName("falls back to the single agency when no agency_id is provided and only one exists")
        void singleAgencyFallback() {
            Agency only = agencyNamed("Only");
            Map<String, Agency> agencies = Map.of("ag-1", only);
            assertThat(RouteImporter.resolveAgency(null, agencies)).isSameAs(only);
            assertThat(RouteImporter.resolveAgency("", agencies)).isSameAs(only);
            assertThat(RouteImporter.resolveAgency("   ", agencies)).isSameAs(only);
        }

        @Test
        @DisplayName("returns null when agency_id is blank and the feed declares multiple agencies")
        void blankIdWithMultipleAgenciesAmbiguous() {
            Map<String, Agency> agencies = new LinkedHashMap<>();
            agencies.put("a", agencyNamed("A"));
            agencies.put("b", agencyNamed("B"));
            assertThat(RouteImporter.resolveAgency(null, agencies)).isNull();
            assertThat(RouteImporter.resolveAgency("", agencies)).isNull();
        }

        @Test
        @DisplayName("returns null when agency_id refers to an unknown agency in a multi-agency feed")
        void unknownAgencyIdInMultiAgencyFeed() {
            Map<String, Agency> agencies = new LinkedHashMap<>();
            agencies.put("a", agencyNamed("A"));
            agencies.put("b", agencyNamed("B"));
            assertThat(RouteImporter.resolveAgency("ghost", agencies)).isNull();
        }
    }
}
