package com.transit.hub.bench;

import com.transit.hub.domain.model.ServiceCalendar;
import com.transit.hub.domain.model.ServiceCalendarException;
import com.transit.hub.domain.model.enums.ServiceExceptionType;
import com.transit.hub.domain.util.ServiceCalendarMatcher;
import org.openjdk.jmh.annotations.Benchmark;
import org.openjdk.jmh.annotations.BenchmarkMode;
import org.openjdk.jmh.annotations.Mode;
import org.openjdk.jmh.annotations.OutputTimeUnit;
import org.openjdk.jmh.annotations.Param;
import org.openjdk.jmh.annotations.Scope;
import org.openjdk.jmh.annotations.Setup;
import org.openjdk.jmh.annotations.State;
import org.openjdk.jmh.infra.Blackhole;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;

import static java.time.DayOfWeek.FRIDAY;
import static java.time.DayOfWeek.MONDAY;
import static java.time.DayOfWeek.SUNDAY;
import static java.time.DayOfWeek.THURSDAY;
import static java.time.DayOfWeek.TUESDAY;
import static java.time.DayOfWeek.WEDNESDAY;

/**
 * Measures {@link ServiceCalendarMatcher#isActive} across realistic
 * calendar shapes.
 *
 * <p>The matcher sits on the hot path of every {@code DisplayState}
 * computation: every arrival is filtered through it before the kiosk
 * sees the time. A regression here multiplies across every Schedule on
 * every refresh, so it earns a benchmark.
 *
 * <p>The {@code exceptions} parameter scans 0 / 5 / 50 dates — covers
 * the realistic spread (most weekday calendars carry zero, public-
 * holiday calendars carry a handful, school-only services carry dozens).
 */
@State(Scope.Benchmark)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.MICROSECONDS)
public class ServiceCalendarMatcherBenchmark {

    @Param({"0", "5", "50"})
    public int exceptions;

    private ServiceCalendar weekdayCalendar;
    private LocalDate insideWeekRange;
    private LocalDate outsideRange;
    private LocalDate exceptionDate;

    @Setup
    public void setUp() {
        Set<java.time.DayOfWeek> weekdays = EnumSet.of(MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY);
        List<ServiceCalendarException> exceptionList = new ArrayList<>();
        LocalDate base = LocalDate.of(2026, 1, 5);  // a Monday
        for (int i = 0; i < exceptions; i++) {
            ServiceExceptionType type = (i % 2 == 0)
                    ? ServiceExceptionType.REMOVED
                    : ServiceExceptionType.ADDED;
            exceptionList.add(ServiceCalendarException.builder()
                    .date(base.plusDays(i * 3L))
                    .exceptionType(type)
                    .build());
        }

        weekdayCalendar = ServiceCalendar.builder()
                .startDate(LocalDate.of(2026, 1, 1))
                .endDate(LocalDate.of(2026, 12, 31))
                .monday(true).tuesday(true).wednesday(true)
                .thursday(true).friday(true).saturday(false).sunday(false)
                .exceptions(exceptionList)
                .build();

        // Wednesday inside the validity window — common case, no
        // exception lookup hit in the empty/small cases.
        insideWeekRange = LocalDate.of(2026, 6, 17);
        // Date past the calendar's end_date.
        outsideRange = LocalDate.of(2027, 2, 1);
        // The calendar's first exception date when there's at least one,
        // otherwise a date that won't match.
        exceptionDate = exceptions > 0 ? base : LocalDate.of(1990, 1, 1);
    }

    @Benchmark
    public boolean weekdayHit() {
        return ServiceCalendarMatcher.isActive(weekdayCalendar, insideWeekRange);
    }

    @Benchmark
    public boolean outsideRange() {
        return ServiceCalendarMatcher.isActive(weekdayCalendar, outsideRange);
    }

    @Benchmark
    public boolean exceptionHit() {
        return ServiceCalendarMatcher.isActive(weekdayCalendar, exceptionDate);
    }

    @Benchmark
    public void mixedTraffic(Blackhole bh) {
        bh.consume(ServiceCalendarMatcher.isActive(weekdayCalendar, insideWeekRange));
        bh.consume(ServiceCalendarMatcher.isActive(weekdayCalendar, outsideRange));
        bh.consume(ServiceCalendarMatcher.isActive(weekdayCalendar, exceptionDate));
    }
}
