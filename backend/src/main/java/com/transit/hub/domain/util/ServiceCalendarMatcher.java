package com.transit.hub.domain.util;

import com.transit.hub.domain.model.ServiceCalendar;
import com.transit.hub.domain.model.ServiceCalendarException;
import com.transit.hub.domain.model.enums.ServiceExceptionType;

import java.time.LocalDate;

/**
 * Tells whether a {@link ServiceCalendar} is running on a given date,
 * applying GTFS resolution rules: {@code calendar_dates.txt} exceptions
 * trump the weekly pattern, and the validity range
 * ({@code start_date}..{@code end_date}) limits both.
 * <p>
 * Treats a null calendar as always active so admin-created or legacy
 * schedules with no FK keep showing every day, the way they did before
 * Phase 1.4 introduced multi-day support.
 */
public final class ServiceCalendarMatcher {

    private ServiceCalendarMatcher() {}

    public static boolean isActive(ServiceCalendar calendar, LocalDate date) {
        if (calendar == null || date == null) {
            return calendar == null; // null calendar = always-on; null date = no answer.
        }
        // calendar_dates.txt exceptions override everything else for that exact date.
        if (calendar.getExceptions() != null) {
            for (ServiceCalendarException ex : calendar.getExceptions()) {
                if (date.equals(ex.getDate())) {
                    return ex.getExceptionType() == ServiceExceptionType.ADDED;
                }
            }
        }
        if (calendar.getStartDate() != null && date.isBefore(calendar.getStartDate())) {
            return false;
        }
        if (calendar.getEndDate() != null && date.isAfter(calendar.getEndDate())) {
            return false;
        }
        return calendar.daysOfWeek().contains(date.getDayOfWeek());
    }
}
