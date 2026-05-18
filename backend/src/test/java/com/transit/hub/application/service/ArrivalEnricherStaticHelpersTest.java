package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.DisplayState;
import com.transit.hub.application.dto.response.LineInfo;
import com.transit.hub.domain.model.BookingRule;
import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.ItineraryStop;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Schedule;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.Translation;
import com.transit.hub.domain.model.enums.BikesAllowed;
import com.transit.hub.domain.model.enums.LineType;
import com.transit.hub.domain.model.enums.WheelchairAccess;
import com.transit.hub.domain.util.TranslationLookup;
import org.junit.jupiter.api.Test;

import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Covers the static helpers extracted on {@link ArrivalEnricher}. Each
 * helper is pure (no Mockito needed) — they fold schedule + itinerary +
 * translation lookups into the kiosk-facing DTO fields.
 */
class ArrivalEnricherStaticHelpersTest {

    // --- resolveBookingInfo -------------------------------------------

    @Test
    void resolveBookingInfo_returnsNullWhenNoRule() {
        Schedule s = scheduleWithBooking(null, (short) 2);
        assertNull(ArrivalEnricher.resolveBookingInfo(s));
    }

    @Test
    void resolveBookingInfo_returnsNullForRegularPickup() {
        BookingRule rule = BookingRule.builder().phone("0123").build();
        Schedule s = scheduleWithBooking(rule, (short) 0);
        assertNull(ArrivalEnricher.resolveBookingInfo(s));
    }

    @Test
    void resolveBookingInfo_returnsDtoForOnRequestAgency() {
        BookingRule rule = BookingRule.builder()
                .phone("0123")
                .bookingUrl("https://book")
                .infoUrl("https://info")
                .message("Réserver 30 min avant")
                .priorNoticeDurationMin(30)
                .build();
        Schedule s = scheduleWithBooking(rule, (short) 2);
        DisplayState.BookingInfo info = ArrivalEnricher.resolveBookingInfo(s);
        assertEquals("0123", info.phone());
        assertEquals("https://book", info.bookingUrl());
        assertEquals(30, info.priorNoticeMinutes());
    }

    @Test
    void resolveBookingInfo_returnsDtoForOnRequestDriver() {
        BookingRule rule = BookingRule.builder().phone("0123").build();
        Schedule s = scheduleWithBooking(rule, (short) 3);
        assertEquals("0123", ArrivalEnricher.resolveBookingInfo(s).phone());
    }

    // --- resolveWheelchair --------------------------------------------

    @Test
    void resolveWheelchair_scheduleOverrideTrueMapsToAccessible() {
        Schedule s = Schedule.builder().wheelchairOverride(true).build();
        Itinerary it = Itinerary.builder().build();
        assertEquals(WheelchairAccess.ACCESSIBLE, ArrivalEnricher.resolveWheelchair(s, it));
    }

    @Test
    void resolveWheelchair_scheduleOverrideFalseMapsToNotAccessible() {
        Schedule s = Schedule.builder().wheelchairOverride(false).build();
        Itinerary it = Itinerary.builder().build();
        assertEquals(WheelchairAccess.NOT_ACCESSIBLE, ArrivalEnricher.resolveWheelchair(s, it));
    }

    @Test
    void resolveWheelchair_fallsBackToItineraryDefault() {
        Schedule s = Schedule.builder().build();
        Itinerary it = Itinerary.builder().wheelchairDefault(WheelchairAccess.ACCESSIBLE).build();
        assertEquals(WheelchairAccess.ACCESSIBLE, ArrivalEnricher.resolveWheelchair(s, it));
    }

    @Test
    void resolveWheelchair_returnsUnknownWhenNothingDeclared() {
        Schedule s = Schedule.builder().build();
        Itinerary it = Itinerary.builder().build();
        assertEquals(WheelchairAccess.UNKNOWN, ArrivalEnricher.resolveWheelchair(s, it));
    }

    // --- resolveBikes -------------------------------------------------

    @Test
    void resolveBikes_scheduleOverrideTakesPrecedence() {
        Schedule s = Schedule.builder().bikesAllowedOverride(true).build();
        Itinerary it = Itinerary.builder().bikesAllowedDefault(BikesAllowed.NOT_ALLOWED).build();
        assertEquals(BikesAllowed.ALLOWED, ArrivalEnricher.resolveBikes(s, it));
    }

    @Test
    void resolveBikes_fallsBackToItineraryDefault() {
        Schedule s = Schedule.builder().build();
        Itinerary it = Itinerary.builder().bikesAllowedDefault(BikesAllowed.ALLOWED).build();
        assertEquals(BikesAllowed.ALLOWED, ArrivalEnricher.resolveBikes(s, it));
    }

    @Test
    void resolveBikes_returnsUnknownWhenNothingDeclared() {
        Schedule s = Schedule.builder().build();
        Itinerary it = Itinerary.builder().build();
        assertEquals(BikesAllowed.UNKNOWN, ArrivalEnricher.resolveBikes(s, it));
    }

    // --- resolveStopHeadsign ------------------------------------------

    @Test
    void resolveStopHeadsign_returnsHeadsignForMatchingStop() {
        UUID stopId = UUID.randomUUID();
        Stop stop = Stop.builder().name("Gare").build();
        stop.setId(stopId);
        ItineraryStop is = ItineraryStop.builder()
                .stop(stop)
                .stopHeadsign("Vers Centre-ville")
                .position(1)
                .build();
        Itinerary it = Itinerary.builder().build();
        it.setItineraryStops(List.of(is));

        assertEquals("Vers Centre-ville", ArrivalEnricher.resolveStopHeadsign(it, stopId));
    }

    @Test
    void resolveStopHeadsign_returnsNullWhenHeadsignBlank() {
        UUID stopId = UUID.randomUUID();
        Stop stop = Stop.builder().name("Gare").build();
        stop.setId(stopId);
        ItineraryStop is = ItineraryStop.builder()
                .stop(stop).stopHeadsign("  ").position(1).build();
        Itinerary it = Itinerary.builder().build();
        it.setItineraryStops(List.of(is));

        assertNull(ArrivalEnricher.resolveStopHeadsign(it, stopId));
    }

    @Test
    void resolveStopHeadsign_returnsNullWhenStopNotInItinerary() {
        Stop stop = Stop.builder().name("Other").build();
        stop.setId(UUID.randomUUID());
        ItineraryStop is = ItineraryStop.builder()
                .stop(stop).stopHeadsign("Hidden").position(1).build();
        Itinerary it = Itinerary.builder().build();
        it.setItineraryStops(List.of(is));

        assertNull(ArrivalEnricher.resolveStopHeadsign(it, UUID.randomUUID()));
    }

    // --- translatedLineInfo --------------------------------------------

    @Test
    void translatedLineInfo_returnsRawLineWhenTranslationsEmpty() {
        Line line = Line.builder()
                .code("L1").name("Line 1")
                .color("FF0000").textColor("FFFFFF")
                .externalId("L1").type(LineType.BUS).build();
        line.setId(UUID.randomUUID());

        LineInfo info = ArrivalEnricher.translatedLineInfo(line, TranslationLookup.empty());

        assertEquals("L1", info.code());
        assertEquals("Line 1", info.name());
    }

    @Test
    void translatedLineInfo_appliesTranslationsWhenAvailable() {
        Line line = Line.builder()
                .code("L1").name("Line 1")
                .color("FF0000").textColor("FFFFFF")
                .externalId("L1").type(LineType.BUS).build();
        line.setId(UUID.randomUUID());

        TranslationLookup translations = TranslationLookup.from(List.of(
                Translation.builder()
                        .tableName("routes").recordId("L1")
                        .fieldName("route_short_name").translation("L1-fr").build(),
                Translation.builder()
                        .tableName("routes").recordId("L1")
                        .fieldName("route_long_name").translation("Ligne 1").build()));

        LineInfo info = ArrivalEnricher.translatedLineInfo(line, translations);

        assertEquals("L1-fr", info.code());
        assertEquals("Ligne 1", info.name());
    }

    // --- helpers -------------------------------------------------------

    private static Schedule scheduleWithBooking(BookingRule rule, short pickupType) {
        return Schedule.builder()
                .time(LocalTime.of(10, 0))
                .pickupType(pickupType)
                .pickupBookingRule(rule)
                .build();
    }
}
