package com.transit.hub.infrastructure.seed.gtfs;

import com.transit.hub.domain.model.enums.LineType;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Map;

/**
 * Pure parsing helpers for GTFS text fields. Extracted from {@link GtfsImportService}
 * so the value-only logic can be unit-tested without booting the importer.
 */
public final class GtfsParse {

    private static final Logger log = LoggerFactory.getLogger(GtfsParse.class);

    private static final DateTimeFormatter GTFS_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");

    private GtfsParse() {}

    /**
     * Parses a GTFS HH:MM:SS time. The format allows hours past midnight (e.g.
     * {@code "25:30:00"} for 1:30 the next day) which {@link LocalTime} cannot
     * represent natively, so the hour component is folded back into the
     * {@code 0..23} range and a {@code WARN} log is emitted so the operator
     * sees the truncation in the import audit trail. See ADR 0042 for the
     * rationale and the future migration path to a {@code BIGINT seconds}
     * representation that would honour the >24h window natively.
     */
    public static @Nullable LocalTime parseGtfsTime(@Nullable String s) {
        if (s == null || s.isBlank()) {return null;}
        String[] parts = s.trim().split(":");
        if (parts.length < 2) {return null;}
        try {
            int rawHour = Integer.parseInt(parts[0]);
            int h = rawHour % 24;
            if (rawHour >= 24) {
                log.warn("GTFS time '{}' exceeds 24h — folded to {}h. "
                        + "LocalTime cannot represent service-day overflow (ADR 0042).",
                        s, h);
            }
            int m = Integer.parseInt(parts[1]);
            int sec = parts.length >= 3 ? Integer.parseInt(parts[2]) : 0;
            return LocalTime.of(h, m, sec);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Parses a GTFS yyyyMMdd date, returning null on blank or invalid input. */
    public static @Nullable LocalDate parseGtfsDate(@Nullable String s) {
        if (s == null || s.isBlank()) {return null;}
        try {return LocalDate.parse(s.trim(), GTFS_DATE);} catch (Exception e) {return null;}
    }

    /**
     * Returns the leading alphabetic prefix of a route short code, upper-cased,
     * stopping at the first non-letter. Used to bucket bus lines whose code
     * follows a "{prefix}{number}" convention (e.g. "C1", "BR12", "N5").
     */
    public static String extractAlphaPrefix(@Nullable String code) {
        if (code == null || code.isBlank()) {return "";}
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < code.length(); i++) {
            char c = code.charAt(i);
            if (Character.isLetter(c)) {sb.append(c);}
            else {break;}
        }
        return sb.toString().toUpperCase(Locale.ROOT);
    }

    /**
     * Maps a GTFS {@code route_type} value to a {@link LineType}.
     * <p>
     * Covers the basic GTFS modes (0..12) and the Extended Route Types
     * (Hierarchical Vehicle Types, range 100..1799) defined by the
     * European TPEG-PTI standard and listed as informational extensions
     * in the GTFS reference.
     */
    public static LineType mapRouteType(int routeType) {
        LineType basic = BASIC_ROUTE_TYPES.get(routeType);
        if (basic != null) {
            return basic;
        }
        return EXTENDED_ROUTE_TYPE_BUCKETS.getOrDefault(routeType / 100, LineType.OTHER);
    }

    /** Basic GTFS modes (0..12). Codes 8, 9 and 10 are reserved and fall
     *  through to the extended bucket — kept absent here so the lookup
     *  naturally hits the OTHER default. */
    private static final Map<Integer, LineType> BASIC_ROUTE_TYPES = Map.ofEntries(
            Map.entry(0, LineType.TRAM),
            Map.entry(1, LineType.METRO),
            Map.entry(2, LineType.TRAIN),
            Map.entry(3, LineType.BUS),
            Map.entry(4, LineType.FERRY),
            Map.entry(5, LineType.CABLE_CAR),
            Map.entry(6, LineType.CABLE_CAR),
            Map.entry(7, LineType.FUNICULAR),
            Map.entry(11, LineType.TROLLEYBUS),
            Map.entry(12, LineType.MONORAIL));

    /** Extended Hierarchical Vehicle Type buckets (TPEG-PTI). Indexed
     *  by {@code routeType / 100}; 16 has no defined mapping in the
     *  spec, so it falls through to OTHER via the {@code getOrDefault}
     *  call upstream. */
    private static final Map<Integer, LineType> EXTENDED_ROUTE_TYPE_BUCKETS = Map.ofEntries(
            Map.entry(1, LineType.TRAIN),       // 100-199 Railway
            Map.entry(2, LineType.BUS),         // 200-299 Coach
            Map.entry(3, LineType.TRAIN),       // 300-399 Suburban Railway
            Map.entry(4, LineType.METRO),       // 400-499 Urban Railway
            Map.entry(5, LineType.METRO),       // 500-599 Metro
            Map.entry(6, LineType.METRO),       // 600-699 Underground
            Map.entry(7, LineType.BUS),         // 700-799 Bus
            Map.entry(8, LineType.TROLLEYBUS),  // 800-899 Trolleybus
            Map.entry(9, LineType.TRAM),        // 900-999 Tram
            Map.entry(10, LineType.FERRY),      // 1000-1099 Water transport
            Map.entry(11, LineType.OTHER),      // 1100-1199 Air
            Map.entry(12, LineType.FERRY),      // 1200-1299 Ferry
            Map.entry(13, LineType.CABLE_CAR),  // 1300-1399 Telecabin
            Map.entry(14, LineType.FUNICULAR),  // 1400-1499 Funicular
            Map.entry(15, LineType.BUS),        // 1500-1599 Taxi
            Map.entry(17, LineType.OTHER));     // 1700-1799 Miscellaneous

    // ------------------------------------------------------------------ //
    // General string / number helpers shared with GtfsImportService       //
    // ------------------------------------------------------------------ //

    public static boolean isBlank(@Nullable String s) {
        return s == null || s.isBlank();
    }

    public static String firstNonBlank(@Nullable String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v.trim();
            }
        }
        return "";
    }

    public static String truncate(@Nullable String s, int max) {
        if (s == null) {
            return "";
        }
        return s.length() <= max ? s : s.substring(0, max);
    }

    public static int parseInt(@Nullable String s, int defaultValue) {
        if (s == null || s.isBlank()) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(s.trim());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    public static @Nullable Integer parseIntOrNull(@Nullable String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        try {
            return Integer.parseInt(s.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public static @Nullable Double parseDoubleOrNull(@Nullable String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        try {
            return Double.parseDouble(s.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public static @Nullable Short parseShortOrNull(@Nullable String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        try {
            return Short.parseShort(s.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * GTFS {@code trips.direction_id} is "0" / "1" / blank. We materialise
     * itineraries by (route, direction) so the in-memory key already
     * carries the value as a String — this just narrows it to the
     * short the column expects, leaving null for feeds that don't
     * declare a direction.
     */
    public static @Nullable Short parseDirectionId(@Nullable String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Short.parseShort(raw.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
