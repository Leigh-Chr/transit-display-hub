package com.transit.hub.domain.util;

import com.transit.hub.domain.model.ServiceCalendar;
import com.transit.hub.domain.model.ServiceCalendarException;
import com.transit.hub.domain.model.enums.ServiceExceptionType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumSet;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("ServiceCalendarMatcher")
class ServiceCalendarMatcherTest {

    private static final LocalDate MONDAY = LocalDate.of(2026, 5, 4);
    private static final LocalDate TUESDAY = LocalDate.of(2026, 5, 5);
    private static final LocalDate SATURDAY = LocalDate.of(2026, 5, 9);
    private static final LocalDate SUNDAY = LocalDate.of(2026, 5, 10);

    @Nested
    @DisplayName("null handling")
    class NullHandling {

        @Test
        @DisplayName("null calendar is always active (legacy / admin schedules)")
        void nullCalendarAlwaysActive() {
            assertThat(ServiceCalendarMatcher.isActive(null, MONDAY)).isTrue();
        }

        @Test
        @DisplayName("null date returns false defensively")
        void nullDateReturnsFalse() {
            ServiceCalendar cal = weekdayCalendar();
            assertThat(ServiceCalendarMatcher.isActive(cal, null)).isFalse();
        }
    }

    @Nested
    @DisplayName("weekly pattern")
    class WeeklyPattern {

        @Test
        @DisplayName("active when calendar's day of week matches")
        void activeOnPatternDay() {
            ServiceCalendar weekday = weekdayCalendar();
            assertThat(ServiceCalendarMatcher.isActive(weekday, MONDAY)).isTrue();
            assertThat(ServiceCalendarMatcher.isActive(weekday, TUESDAY)).isTrue();
        }

        @Test
        @DisplayName("inactive when calendar's day of week does not match")
        void inactiveOffPatternDay() {
            ServiceCalendar weekday = weekdayCalendar();
            assertThat(ServiceCalendarMatcher.isActive(weekday, SATURDAY)).isFalse();
            assertThat(ServiceCalendarMatcher.isActive(weekday, SUNDAY)).isFalse();
        }

        @Test
        @DisplayName("weekend calendar matches saturday and sunday only")
        void weekendCalendar() {
            ServiceCalendar weekend = calendar(EnumSet.of(DayOfWeek.SATURDAY, DayOfWeek.SUNDAY),
                    LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31));
            assertThat(ServiceCalendarMatcher.isActive(weekend, SATURDAY)).isTrue();
            assertThat(ServiceCalendarMatcher.isActive(weekend, SUNDAY)).isTrue();
            assertThat(ServiceCalendarMatcher.isActive(weekend, MONDAY)).isFalse();
        }
    }

    @Nested
    @DisplayName("validity range")
    class ValidityRange {

        @Test
        @DisplayName("inactive before start date")
        void beforeStart() {
            ServiceCalendar cal = weekdayCalendar();
            cal.setStartDate(LocalDate.of(2026, 6, 1));
            assertThat(ServiceCalendarMatcher.isActive(cal, MONDAY)).isFalse();
        }

        @Test
        @DisplayName("inactive after end date")
        void afterEnd() {
            ServiceCalendar cal = weekdayCalendar();
            cal.setEndDate(LocalDate.of(2026, 4, 30));
            assertThat(ServiceCalendarMatcher.isActive(cal, MONDAY)).isFalse();
        }

        @Test
        @DisplayName("active on the start date itself")
        void activeOnStart() {
            ServiceCalendar cal = weekdayCalendar();
            cal.setStartDate(MONDAY);
            assertThat(ServiceCalendarMatcher.isActive(cal, MONDAY)).isTrue();
        }
    }

    @Nested
    @DisplayName("calendar_dates exceptions")
    class Exceptions {

        @Test
        @DisplayName("ADDED makes a non-pattern day active")
        void addedExceptionOverridesPattern() {
            ServiceCalendar weekday = weekdayCalendar();
            weekday.getExceptions().add(exception(weekday, SATURDAY, ServiceExceptionType.ADDED));
            assertThat(ServiceCalendarMatcher.isActive(weekday, SATURDAY)).isTrue();
        }

        @Test
        @DisplayName("REMOVED makes a pattern day inactive (e.g. public holiday)")
        void removedExceptionCancelsPattern() {
            ServiceCalendar weekday = weekdayCalendar();
            weekday.getExceptions().add(exception(weekday, MONDAY, ServiceExceptionType.REMOVED));
            assertThat(ServiceCalendarMatcher.isActive(weekday, MONDAY)).isFalse();
        }

        @Test
        @DisplayName("exception trumps validity range too")
        void addedExceptionOutsideRangeStillActive() {
            ServiceCalendar cal = weekdayCalendar();
            cal.setStartDate(LocalDate.of(2026, 6, 1));
            cal.getExceptions().add(exception(cal, MONDAY, ServiceExceptionType.ADDED));
            assertThat(ServiceCalendarMatcher.isActive(cal, MONDAY)).isTrue();
        }
    }

    private static ServiceCalendar weekdayCalendar() {
        return calendar(EnumSet.of(DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
                        DayOfWeek.THURSDAY, DayOfWeek.FRIDAY),
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31));
    }

    private static ServiceCalendar calendar(EnumSet<DayOfWeek> days, LocalDate start, LocalDate end) {
        ServiceCalendar cal = ServiceCalendar.builder()
                .externalId("test-cal")
                .startDate(start)
                .endDate(end)
                .exceptions(new ArrayList<>())
                .build();
        cal.setDaysOfWeek(days);
        return cal;
    }

    private static ServiceCalendarException exception(ServiceCalendar cal, LocalDate date,
                                                       ServiceExceptionType type) {
        return ServiceCalendarException.builder()
                .serviceCalendar(cal)
                .date(date)
                .exceptionType(type)
                .build();
    }
}
