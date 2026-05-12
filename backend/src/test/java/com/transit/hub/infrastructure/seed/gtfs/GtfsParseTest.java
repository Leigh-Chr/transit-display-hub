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

    @Nested
    @DisplayName("isBlank")
    class IsBlank {

        @Test
        @DisplayName("treats null, empty and whitespace-only strings as blank")
        void blankCases() {
            assertThat(GtfsParse.isBlank(null)).isTrue();
            assertThat(GtfsParse.isBlank("")).isTrue();
            assertThat(GtfsParse.isBlank("   ")).isTrue();
            assertThat(GtfsParse.isBlank("\t\n ")).isTrue();
        }

        @Test
        @DisplayName("returns false for any string that contains a non-whitespace character")
        void nonBlankCases() {
            assertThat(GtfsParse.isBlank("a")).isFalse();
            assertThat(GtfsParse.isBlank(" hello ")).isFalse();
            assertThat(GtfsParse.isBlank("0")).isFalse();
        }
    }

    @Nested
    @DisplayName("firstNonBlank")
    class FirstNonBlank {

        @Test
        @DisplayName("returns the first non-blank value trimmed")
        void firstWins() {
            assertThat(GtfsParse.firstNonBlank("hello", "world")).isEqualTo("hello");
            assertThat(GtfsParse.firstNonBlank("  hello  ", "world")).isEqualTo("hello");
        }

        @Test
        @DisplayName("skips blank entries and returns the next usable one")
        void skipsBlanks() {
            assertThat(GtfsParse.firstNonBlank(null, "", "  ", "found")).isEqualTo("found");
        }

        @Test
        @DisplayName("returns empty string when every candidate is blank")
        void allBlank() {
            assertThat(GtfsParse.firstNonBlank()).isEqualTo("");
            assertThat(GtfsParse.firstNonBlank((String) null)).isEqualTo("");
            assertThat(GtfsParse.firstNonBlank(null, "", "   ")).isEqualTo("");
        }
    }

    @Nested
    @DisplayName("truncate")
    class Truncate {

        @Test
        @DisplayName("returns the input when it fits within the limit")
        void noTruncationNeeded() {
            assertThat(GtfsParse.truncate("hello", 10)).isEqualTo("hello");
            assertThat(GtfsParse.truncate("hello", 5)).isEqualTo("hello");
        }

        @Test
        @DisplayName("cuts the string to exactly max characters")
        void cuts() {
            assertThat(GtfsParse.truncate("abcdefghij", 4)).isEqualTo("abcd");
            assertThat(GtfsParse.truncate("abcdefghij", 0)).isEqualTo("");
        }

        @Test
        @DisplayName("returns empty string for null input rather than throwing")
        void nullSafe() {
            assertThat(GtfsParse.truncate(null, 5)).isEqualTo("");
        }
    }

    @Nested
    @DisplayName("parseInt")
    class ParseInt {

        @Test
        @DisplayName("parses well-formed integers and trims whitespace")
        void parses() {
            assertThat(GtfsParse.parseInt("42", 0)).isEqualTo(42);
            assertThat(GtfsParse.parseInt("  42  ", 0)).isEqualTo(42);
            assertThat(GtfsParse.parseInt("-7", 0)).isEqualTo(-7);
        }

        @Test
        @DisplayName("returns the default value for blank input")
        void blankReturnsDefault() {
            assertThat(GtfsParse.parseInt(null, 99)).isEqualTo(99);
            assertThat(GtfsParse.parseInt("", 99)).isEqualTo(99);
            assertThat(GtfsParse.parseInt("   ", 99)).isEqualTo(99);
        }

        @Test
        @DisplayName("returns the default value on garbage input rather than throwing")
        void invalidReturnsDefault() {
            assertThat(GtfsParse.parseInt("abc", 7)).isEqualTo(7);
            assertThat(GtfsParse.parseInt("3.14", 7)).isEqualTo(7);
        }
    }

    @Nested
    @DisplayName("parseIntOrNull")
    class ParseIntOrNull {

        @Test
        @DisplayName("returns the parsed value when input is a valid integer")
        void parses() {
            assertThat(GtfsParse.parseIntOrNull("123")).isEqualTo(123);
            assertThat(GtfsParse.parseIntOrNull("  -5 ")).isEqualTo(-5);
        }

        @Test
        @DisplayName("returns null for blank or invalid input")
        void blankOrInvalid() {
            assertThat(GtfsParse.parseIntOrNull(null)).isNull();
            assertThat(GtfsParse.parseIntOrNull("")).isNull();
            assertThat(GtfsParse.parseIntOrNull("   ")).isNull();
            assertThat(GtfsParse.parseIntOrNull("abc")).isNull();
            assertThat(GtfsParse.parseIntOrNull("3.14")).isNull();
        }
    }

    @Nested
    @DisplayName("parseDoubleOrNull")
    class ParseDoubleOrNull {

        @Test
        @DisplayName("parses both integer and decimal forms")
        void parses() {
            assertThat(GtfsParse.parseDoubleOrNull("3.14")).isEqualTo(3.14);
            assertThat(GtfsParse.parseDoubleOrNull("42")).isEqualTo(42.0);
            assertThat(GtfsParse.parseDoubleOrNull("  -0.5 ")).isEqualTo(-0.5);
        }

        @Test
        @DisplayName("returns null for blank or invalid input")
        void blankOrInvalid() {
            assertThat(GtfsParse.parseDoubleOrNull(null)).isNull();
            assertThat(GtfsParse.parseDoubleOrNull("")).isNull();
            assertThat(GtfsParse.parseDoubleOrNull("not-a-number")).isNull();
        }
    }

    @Nested
    @DisplayName("parseShortOrNull")
    class ParseShortOrNull {

        @Test
        @DisplayName("parses values within the short range")
        void parses() {
            assertThat(GtfsParse.parseShortOrNull("0")).isEqualTo((short) 0);
            assertThat(GtfsParse.parseShortOrNull("1")).isEqualTo((short) 1);
            assertThat(GtfsParse.parseShortOrNull("  42 ")).isEqualTo((short) 42);
        }

        @Test
        @DisplayName("returns null for blank input")
        void blank() {
            assertThat(GtfsParse.parseShortOrNull(null)).isNull();
            assertThat(GtfsParse.parseShortOrNull("")).isNull();
            assertThat(GtfsParse.parseShortOrNull("   ")).isNull();
        }

        @Test
        @DisplayName("returns null on garbage or out-of-range values rather than throwing")
        void invalidReturnsNull() {
            assertThat(GtfsParse.parseShortOrNull("abc")).isNull();
            // 100_000 is outside the short range
            assertThat(GtfsParse.parseShortOrNull("100000")).isNull();
        }
    }

    @Nested
    @DisplayName("parseDirectionId")
    class ParseDirectionId {

        @Test
        @DisplayName("parses GTFS direction id 0 / 1")
        void standard() {
            assertThat(GtfsParse.parseDirectionId("0")).isEqualTo((short) 0);
            assertThat(GtfsParse.parseDirectionId("1")).isEqualTo((short) 1);
        }

        @Test
        @DisplayName("returns null for blank input (the GTFS column is optional)")
        void blank() {
            assertThat(GtfsParse.parseDirectionId(null)).isNull();
            assertThat(GtfsParse.parseDirectionId("")).isNull();
            assertThat(GtfsParse.parseDirectionId("   ")).isNull();
        }

        @Test
        @DisplayName("returns null on garbage input rather than throwing")
        void invalid() {
            assertThat(GtfsParse.parseDirectionId("abc")).isNull();
            assertThat(GtfsParse.parseDirectionId("2.5")).isNull();
        }

        @Test
        @DisplayName("trims surrounding whitespace")
        void trims() {
            assertThat(GtfsParse.parseDirectionId("  1  ")).isEqualTo((short) 1);
        }
    }
}
