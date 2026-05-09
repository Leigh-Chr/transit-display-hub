package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.FlexStopTimeResponse;
import com.transit.hub.domain.model.FlexStopTime;
import com.transit.hub.domain.model.ServiceCalendar;
import com.transit.hub.infrastructure.persistence.FlexStopTimeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

/**
 * Resolves which GTFS-flex windows are available right now (or at a
 * given target date) for a TAD location. Combines
 * {@link com.transit.hub.domain.model.FlexStopTime} rows with the
 * row's {@link ServiceCalendar} so the kiosk / popup can render
 * "réservation possible aujourd'hui de 11h à 13h".
 */
@Service
@RequiredArgsConstructor
public class FlexAvailabilityService {

    private final FlexStopTimeRepository flexStopTimeRepository;
    private final Clock clock;

    /** Lists every flex window available at the given location today,
     *  filtering by service calendar weekday. The {@code locationId}
     *  is the GTFS external id (geojson Feature.id). */
    @Transactional(readOnly = true)
    public List<FlexStopTimeResponse> findWindowsForLocation(String externalId, LocalDate date) {
        final LocalDate target = date != null ? date : LocalDate.now(clock);
        return flexStopTimeRepository.findByLocationExternalId(externalId).stream()
                .filter(f -> serviceActiveOn(f.getServiceCalendar(), target))
                .sorted(Comparator.comparing(FlexStopTime::getStartPickupDropOffWindow))
                .map(FlexStopTimeResponse::from)
                .toList();
    }

    /** Lists every persisted flex stop time, eagerly loaded for an
     *  admin browse page. Sorted by itinerary then stop_sequence. */
    @Transactional(readOnly = true)
    public List<FlexStopTimeResponse> browse() {
        return flexStopTimeRepository.findAllWithRelations().stream()
                .map(FlexStopTimeResponse::from)
                .toList();
    }

    /** Returns true when the calendar is null (legacy "always active")
     *  OR the calendar has the day-of-week flag set OR an explicit
     *  ADDED exception covers that date AND no REMOVED exception
     *  cancels it. Mirrors the rules used by
     *  {@code DisplayStateCalculator}. */
    private static boolean serviceActiveOn(ServiceCalendar calendar, LocalDate date) {
        if (calendar == null) {return true;}
        // Date window
        if (calendar.getStartDate() != null && date.isBefore(calendar.getStartDate())) {return false;}
        if (calendar.getEndDate() != null && date.isAfter(calendar.getEndDate())) {return false;}

        // Exceptions take precedence
        boolean addedException = calendar.getExceptions().stream()
                .anyMatch(e -> date.equals(e.getDate())
                        && e.getExceptionType() == com.transit.hub.domain.model.enums.ServiceExceptionType.ADDED);
        boolean removedException = calendar.getExceptions().stream()
                .anyMatch(e -> date.equals(e.getDate())
                        && e.getExceptionType() == com.transit.hub.domain.model.enums.ServiceExceptionType.REMOVED);
        if (removedException) {return false;}
        if (addedException) {return true;}

        return switch (date.getDayOfWeek()) {
            case MONDAY -> calendar.isMonday();
            case TUESDAY -> calendar.isTuesday();
            case WEDNESDAY -> calendar.isWednesday();
            case THURSDAY -> calendar.isThursday();
            case FRIDAY -> calendar.isFriday();
            case SATURDAY -> calendar.isSaturday();
            case SUNDAY -> calendar.isSunday();
        };
    }
}
