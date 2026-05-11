package com.transit.hub.infrastructure.seed.gtfs.model;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.Set;

/**
 * In-memory parsing buffer for a GTFS service calendar. Persisted later as a
 * {@code ServiceCalendar} entity once we know which {@code service_id}s are
 * referenced by trips.
 */
public record ServiceCalendarSnapshot(
        LocalDate startDate,
        LocalDate endDate,
        Set<DayOfWeek> daysOfWeek,
        Set<LocalDate> addedDates,
        Set<LocalDate> removedDates) {

    public boolean isActiveOn(LocalDate date) {
        if (removedDates.contains(date)) { return false; }
        if (addedDates.contains(date)) { return true; }
        if (startDate == null || endDate == null || daysOfWeek.isEmpty()) { return false; }
        if (date.isBefore(startDate) || date.isAfter(endDate)) { return false; }
        return daysOfWeek.contains(date.getDayOfWeek());
    }

    // ---------- builder ----------

    public static final class Builder {
        private LocalDate startDate;
        private LocalDate endDate;
        private Set<DayOfWeek> days = EnumSet.noneOf(DayOfWeek.class);
        private final Set<LocalDate> added = new HashSet<>();
        private final Set<LocalDate> removed = new HashSet<>();

        public void withWeekly(LocalDate start, LocalDate end, Set<DayOfWeek> daysOfWeek) {
            this.startDate = start;
            this.endDate = end;
            this.days = daysOfWeek;
        }

        public void added(LocalDate date) { added.add(date); }
        public void removed(LocalDate date) { removed.add(date); }

        public ServiceCalendarSnapshot build() {
            return new ServiceCalendarSnapshot(startDate, endDate, days, added, removed);
        }
    }
}
