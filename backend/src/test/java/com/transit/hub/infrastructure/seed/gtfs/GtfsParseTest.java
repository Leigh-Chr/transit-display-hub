package com.transit.hub.infrastructure.seed.gtfs;

import com.transit.hub.domain.model.enums.LineType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.LocalDate;
import java.time.LocalTime;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("GtfsParse")
class GtfsParseTest {

    @Nested
    @DisplayName("parseGtfsTime")
    class ParseTime {

        @Test
        @DisplayName("returns null for null/blank input")
        void blank() {
            assertThat(GtfsParse.parseGtfsTime(null)).isNull();
            assertThat(GtfsParse.parseGtfsTime("")).isNull();
            assertThat(GtfsParse.parseGtfsTime("   ")).isNull();
        }

        @Test
        @DisplayName("parses standard HH:MM:SS")
        void standard() {
            assertThat(GtfsParse.parseGtfsTime("06:30:00")).isEqualTo(LocalTime.of(6, 30, 0));
            assertThat(GtfsParse.parseGtfsTime("23:59:59")).isEqualTo(LocalTime.of(23, 59, 59));
        }

        @Test
        @DisplayName("accepts HH:MM without seconds")
        void noSeconds() {
            assertThat(GtfsParse.parseGtfsTime("08:15")).isEqualTo(LocalTime.of(8, 15, 0));
        }

        @Test
        @DisplayName("folds 24+ hours back into the 0..23 range")
        void wrapsPastMidnight() {
            // GTFS allows times beyond 24 to denote next-day services on the
            // same operational date. We discard the date and keep only the time.
            assertThat(GtfsParse.parseGtfsTime("25:30:00")).isEqualTo(LocalTime.of(1, 30, 0));
            assertThat(GtfsParse.parseGtfsTime("24:00:00")).isEqualTo(LocalTime.of(0, 0, 0));
            assertThat(GtfsParse.parseGtfsTime("27:45:30")).isEqualTo(LocalTime.of(3, 45, 30));
        }

        @Test
        @DisplayName("trims leading/trailing whitespace")
        void trims() {
            assertThat(GtfsParse.parseGtfsTime("  10:00:00  ")).isEqualTo(LocalTime.of(10, 0, 0));
        }

        @Test
        @DisplayName("returns null on garbage input")
        void invalid() {
            assertThat(GtfsParse.parseGtfsTime("not-a-time")).isNull();
            assertThat(GtfsParse.parseGtfsTime("12")).isNull();
            assertThat(GtfsParse.parseGtfsTime("12:ab")).isNull();
        }
    }

    @Nested
    @DisplayName("parseGtfsDate")
    class ParseDate {

        @Test
        @DisplayName("parses yyyyMMdd")
        void standard() {
            assertThat(GtfsParse.parseGtfsDate("20260505")).isEqualTo(LocalDate.of(2026, 5, 5));
            assertThat(GtfsParse.parseGtfsDate("20240101")).isEqualTo(LocalDate.of(2024, 1, 1));
        }

        @Test
        @DisplayName("returns null on blank input")
        void blank() {
            assertThat(GtfsParse.parseGtfsDate(null)).isNull();
            assertThat(GtfsParse.parseGtfsDate("")).isNull();
            assertThat(GtfsParse.parseGtfsDate("   ")).isNull();
        }

        @Test
        @DisplayName("returns null on invalid input rather than throwing")
        void invalid() {
            assertThat(GtfsParse.parseGtfsDate("2026-05-05")).isNull(); // wrong separator
            assertThat(GtfsParse.parseGtfsDate("20261332")).isNull();    // impossible date
            assertThat(GtfsParse.parseGtfsDate("garbage")).isNull();
        }

        @Test
        @DisplayName("trims whitespace")
        void trims() {
            assertThat(GtfsParse.parseGtfsDate("  20260505 ")).isEqualTo(LocalDate.of(2026, 5, 5));
        }
    }

    @Nested
    @DisplayName("extractAlphaPrefix")
    class ExtractPrefix {

        @Test
        @DisplayName("returns empty for blank input")
        void blank() {
            assertThat(GtfsParse.extractAlphaPrefix(null)).isEmpty();
            assertThat(GtfsParse.extractAlphaPrefix("")).isEmpty();
            assertThat(GtfsParse.extractAlphaPrefix("   ")).isEmpty();
        }

        @Test
        @DisplayName("returns empty for purely numeric codes")
        void numericOnly() {
            assertThat(GtfsParse.extractAlphaPrefix("1")).isEmpty();
            assertThat(GtfsParse.extractAlphaPrefix("30")).isEmpty();
            assertThat(GtfsParse.extractAlphaPrefix("404")).isEmpty();
        }

        @Test
        @DisplayName("returns the leading letters of mixed codes, upper-cased")
        void mixed() {
            assertThat(GtfsParse.extractAlphaPrefix("C1")).isEqualTo("C");
            assertThat(GtfsParse.extractAlphaPrefix("BR12")).isEqualTo("BR");
            assertThat(GtfsParse.extractAlphaPrefix("n5")).isEqualTo("N");
            assertThat(GtfsParse.extractAlphaPrefix("Lianes 1")).isEqualTo("LIANES");
        }

        @Test
        @DisplayName("returns the whole code when it is purely alphabetic")
        void allLetters() {
            assertThat(GtfsParse.extractAlphaPrefix("Tram")).isEqualTo("TRAM");
            assertThat(GtfsParse.extractAlphaPrefix("A")).isEqualTo("A");
        }

        @Test
        @DisplayName("stops at the first non-letter character")
        void stopsEarly() {
            assertThat(GtfsParse.extractAlphaPrefix("C-3")).isEqualTo("C");
            assertThat(GtfsParse.extractAlphaPrefix("X.42")).isEqualTo("X");
            assertThat(GtfsParse.extractAlphaPrefix("E2")).isEqualTo("E");
        }
    }

    @Nested
    @DisplayName("mapRouteType")
    class MapRouteType {

        @ParameterizedTest(name = "route_type {0} → {1}")
        @CsvSource({
                "0, TRAM",
                "1, METRO",
                "2, TRAIN",
                "3, BUS",
                "4, FERRY",
                "5, CABLE_CAR",
                "6, CABLE_CAR",
                "7, FUNICULAR",
                "11, TROLLEYBUS",
                "12, MONORAIL",
        })
        @DisplayName("maps the basic GTFS modes")
        void basic(int routeType, LineType expected) {
            assertThat(GtfsParse.mapRouteType(routeType)).isEqualTo(expected);
        }

        @ParameterizedTest(name = "HVT {0} → {1}")
        @CsvSource({
                // Railway 100-199
                "100, TRAIN", "101, TRAIN", "102, TRAIN", "199, TRAIN",
                // Coach 200-299
                "200, BUS", "204, BUS",
                // Suburban Railway 300-399
                "300, TRAIN", "301, TRAIN",
                // Urban Railway 400-499
                "400, METRO", "401, METRO", "405, METRO",
                // Metro 500-599
                "500, METRO",
                // Underground 600-699
                "600, METRO",
                // Bus 700-799
                "700, BUS", "702, BUS", "715, BUS",
                // Trolleybus 800-899
                "800, TROLLEYBUS",
                // Tram 900-999
                "900, TRAM", "901, TRAM",
                // Water transport 1000-1099
                "1000, FERRY",
                // Air 1100-1199 (modelled as OTHER, no Line icon for planes)
                "1100, OTHER",
                // Ferry 1200-1299
                "1200, FERRY",
                // Telecabin / aerial 1300-1399
                "1300, CABLE_CAR",
                // Funicular 1400-1499
                "1400, FUNICULAR",
                // Taxi 1500-1599
                "1500, BUS",
                // Misc 1700-1799
                "1700, OTHER",
        })
        @DisplayName("maps the extended Hierarchical Vehicle Types")
        void hvt(int routeType, LineType expected) {
            assertThat(GtfsParse.mapRouteType(routeType)).isEqualTo(expected);
        }

        @ParameterizedTest(name = "unknown route_type {0} → OTHER")
        @CsvSource({"-1", "8", "9", "10", "13", "99", "1600", "1800", "9999"})
        @DisplayName("falls back to OTHER for values not covered")
        void unknown(int routeType) {
            assertThat(GtfsParse.mapRouteType(routeType)).isEqualTo(LineType.OTHER);
        }
    }
}
