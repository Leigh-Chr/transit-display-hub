package com.transit.hub.infrastructure.seed.gtfs;

import com.transit.hub.domain.model.enums.LineType;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

/**
 * Pure parsing helpers for GTFS text fields. Extracted from {@link GtfsImportService}
 * so the value-only logic can be unit-tested without booting the importer.
 */
final class GtfsParse {

    private static final DateTimeFormatter GTFS_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");

    private GtfsParse() {}

    /**
     * Parses a GTFS HH:MM:SS time. The format allows hours past midnight (e.g.
     * {@code "25:30:00"} for 1:30 the next day) which {@link LocalTime} cannot
     * represent natively, so the hour component is folded back into the
     * {@code 0..23} range. Acceptable loss of date information for kiosk display.
     */
    static LocalTime parseGtfsTime(String s) {
        if (isBlank(s)) {return null;}
        String[] parts = s.trim().split(":");
        if (parts.length < 2) {return null;}
        try {
            int h = Integer.parseInt(parts[0]) % 24;
            int m = Integer.parseInt(parts[1]);
            int sec = parts.length >= 3 ? Integer.parseInt(parts[2]) : 0;
            return LocalTime.of(h, m, sec);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Parses a GTFS yyyyMMdd date, returning null on blank or invalid input. */
    static LocalDate parseGtfsDate(String s) {
        if (isBlank(s)) {return null;}
        try {return LocalDate.parse(s.trim(), GTFS_DATE);} catch (Exception e) {return null;}
    }

    /**
     * Returns the leading alphabetic prefix of a route short code, upper-cased,
     * stopping at the first non-letter. Used to bucket bus lines whose code
     * follows a "{prefix}{number}" convention (e.g. "C1", "BR12", "N5").
     */
    static String extractAlphaPrefix(String code) {
        if (isBlank(code)) {return "";}
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < code.length(); i++) {
            char c = code.charAt(i);
            if (Character.isLetter(c)) {sb.append(c);}
            else {break;}
        }
        return sb.toString().toUpperCase();
    }

    /**
     * Maps a GTFS {@code route_type} value to a {@link LineType}.
     * <p>
     * Covers the basic GTFS modes (0..12) and the Extended Route Types
     * (Hierarchical Vehicle Types, range 100..1799) defined by the
     * European TPEG-PTI standard and listed as informational extensions
     * in the GTFS reference.
     */
    static LineType mapRouteType(int routeType) {
        switch (routeType) {
            case 0: return LineType.TRAM;          // Tram, Streetcar, Light rail
            case 1: return LineType.METRO;         // Subway, Metro
            case 2: return LineType.TRAIN;         // Rail
            case 3: return LineType.BUS;           // Bus
            case 4: return LineType.FERRY;         // Ferry
            case 5: return LineType.CABLE_CAR;     // Cable tram
            case 6: return LineType.CABLE_CAR;     // Aerial lift / suspended cable car
            case 7: return LineType.FUNICULAR;     // Funicular
            case 11: return LineType.TROLLEYBUS;   // Trolleybus
            case 12: return LineType.MONORAIL;     // Monorail
            default: break;
        }

        int bucket = routeType / 100;
        return switch (bucket) {
            case 1 -> LineType.TRAIN;        // 100-199 Railway
            case 2 -> LineType.BUS;          // 200-299 Coach
            case 3 -> LineType.TRAIN;        // 300-399 Suburban Railway
            case 4 -> LineType.METRO;        // 400-499 Urban Railway
            case 5 -> LineType.METRO;        // 500-599 Metro
            case 6 -> LineType.METRO;        // 600-699 Underground
            case 7 -> LineType.BUS;          // 700-799 Bus
            case 8 -> LineType.TROLLEYBUS;   // 800-899 Trolleybus
            case 9 -> LineType.TRAM;         // 900-999 Tram
            case 10 -> LineType.FERRY;       // 1000-1099 Water transport
            case 11 -> LineType.OTHER;       // 1100-1199 Air
            case 12 -> LineType.FERRY;       // 1200-1299 Ferry
            case 13 -> LineType.CABLE_CAR;   // 1300-1399 Telecabin
            case 14 -> LineType.FUNICULAR;   // 1400-1499 Funicular
            case 15 -> LineType.BUS;         // 1500-1599 Taxi
            case 17 -> LineType.OTHER;       // 1700-1799 Miscellaneous
            default -> LineType.OTHER;
        };
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
