package com.transit.hub.infrastructure.seed.gtfs;

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

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
