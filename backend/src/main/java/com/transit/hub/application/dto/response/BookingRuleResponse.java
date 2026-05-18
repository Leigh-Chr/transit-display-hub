package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.BookingRule;
import com.transit.hub.domain.model.enums.BookingType;
import org.jspecify.annotations.Nullable;

import java.time.LocalTime;
import java.util.UUID;

/**
 * Read-only DTO over GTFS {@code booking_rules.txt}. Carries the
 * full rule so an admin (and a future passenger surface) can render
 * "phone +33… at least 30 min before departure" without joining
 * tables client-side.
 */
public record BookingRuleResponse(
        UUID id,
        String externalId,
        BookingType bookingType,
        @Nullable Integer priorNoticeDurationMin,
        @Nullable Integer priorNoticeDurationMax,
        @Nullable Integer priorNoticeLastDay,
        @Nullable LocalTime priorNoticeLastTime,
        @Nullable Integer priorNoticeStartDay,
        @Nullable String phone,
        @Nullable String bookingUrl,
        @Nullable String infoUrl,
        @Nullable String message
) {
    public static BookingRuleResponse from(BookingRule b) {
        return new BookingRuleResponse(
                b.getId(),
                b.getExternalId(),
                b.getBookingType(),
                b.getPriorNoticeDurationMin(),
                b.getPriorNoticeDurationMax(),
                b.getPriorNoticeLastDay(),
                b.getPriorNoticeLastTime(),
                b.getPriorNoticeStartDay(),
                b.getPhone(),
                b.getBookingUrl(),
                b.getInfoUrl(),
                b.getMessage()
        );
    }
}
