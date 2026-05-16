package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.DisplayState;
import com.transit.hub.application.dto.response.LineInfo;
import com.transit.hub.domain.model.BookingRule;
import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Schedule;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.BikesAllowed;
import com.transit.hub.domain.model.enums.PickupKind;
import com.transit.hub.domain.model.enums.WheelchairAccess;
import com.transit.hub.domain.util.TranslationLookup;
import com.transit.hub.infrastructure.realtime.RealtimeTripUpdateCache;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Builds {@link DisplayState.ArrivalInfo} rows out of a {@link Schedule},
 * folding in GTFS-RT trip-update adjustments (delays, skipped stops),
 * accessibility overrides, booking metadata for on-demand stops and the
 * preferred-language translations for line / headsign labels.
 *
 * <p>Extracted from {@link DisplayStateCalculator} so the schedule-to-
 * passenger-DTO transformation has a single home that can be unit-tested
 * without standing up the full display state pipeline (calendars,
 * messages, ordering, deduplication…).
 */
@Service
@RequiredArgsConstructor
public class ArrivalEnricher {

    private final RealtimeTripUpdateCache realtimeTripUpdateCache;

    /**
     * Builds the passenger-facing arrival row from a persisted schedule.
     * Pulls in the GTFS-RT delay (per stop > trip-level), the
     * accessibility overrides, the translated destination headsign and
     * the booking CTA when applicable.
     */
    public DisplayState.ArrivalInfo toArrivalInfo(Schedule schedule, UUID stopId,
                                                   TranslationLookup translations) {
        Itinerary itinerary = schedule.getItinerary();
        LineInfo lineInfo = translatedLineInfo(itinerary.getLine(), translations);
        // stop_headsign overrides the trip-level terminus when the feed
        // declares a stop-specific destination (loop services, terminus
        // short-running, branching). Falls through to the itinerary's
        // trip_headsign translation, then to the terminus name.
        // The stop_times translation key is composite: record_id is
        // stop_id (the kiosk stop), record_sub_id is trip_id (the
        // representative trip carried by the itinerary).
        String destination = resolveStopHeadsign(itinerary, stopId);
        if (destination != null && schedule.getStop() != null) {
            String translated = translations.resolve(
                    "stop_times",
                    schedule.getStop().getExternalId(),
                    itinerary.getExternalId(),
                    "stop_headsign",
                    null
            ).orElse(null);
            if (translated != null) {destination = translated;}
        }
        if (destination == null) {
            destination = translations.resolveOr("trips", itinerary.getExternalId(), "trip_headsign",
                    resolveTranslatedTerminus(itinerary, translations));
        }
        // Realtime delay: positive = late, negative = early. The
        // scheduled time stays as-published; the kiosk applies the
        // delta itself so a "scheduled / live" comparison is possible.
        Integer delay = resolveRealtimeDelay(schedule);
        return new DisplayState.ArrivalInfo(
                schedule.getTime(),
                destination,
                lineInfo,
                PickupKind.from(schedule.getPickupType(), schedule.getDropOffType()),
                resolveWheelchair(schedule, itinerary),
                resolveBikes(schedule, itinerary),
                schedule.isTimepoint(),
                schedule.getFrequencyHeadwaySeconds(),
                delay,
                schedule.getStop() != null ? schedule.getStop().getPlatformCode() : null,
                resolveBookingInfo(schedule)
        );
    }

    /**
     * True when the GTFS-RT feed marks this stop / trip pair as
     * skipped. The display calculator drops the schedule entirely so
     * the kiosk doesn't show a phantom departure.
     */
    public boolean isRealtimeSkipped(Schedule schedule) {
        Itinerary itinerary = schedule.getItinerary();
        if (itinerary.getExternalId() == null) {return false;}
        String stopExternalId = schedule.getStop() != null
                ? schedule.getStop().getExternalId() : null;
        if (stopExternalId == null) {return false;}
        return realtimeTripUpdateCache.findUpdate(itinerary.getExternalId())
                .map(update -> {
                    var stopAdj = update.byStopExternalId().get(stopExternalId);
                    return stopAdj != null && stopAdj.skipped();
                })
                .orElse(false);
    }

    /**
     * Looks the schedule up against the GTFS-RT trip-update cache.
     * Matching: itinerary's representative trip_id → trip-level
     * adjustment, then stop's external_id → stop-level adjustment.
     * The stop-level delay wins when both are present.
     */
    Integer resolveRealtimeDelay(Schedule schedule) {
        Itinerary itinerary = schedule.getItinerary();
        if (itinerary.getExternalId() == null) {return null;}
        return realtimeTripUpdateCache.findUpdate(itinerary.getExternalId())
                .map(update -> {
                    String stopExternalId = schedule.getStop() != null
                            ? schedule.getStop().getExternalId() : null;
                    if (stopExternalId != null && update.byStopExternalId().containsKey(stopExternalId)) {
                        Integer perStop = update.byStopExternalId().get(stopExternalId).effectiveDelaySeconds();
                        if (perStop != null) {return perStop;}
                    }
                    return update.tripLevelDelaySeconds();
                })
                .orElse(null);
    }

    /**
     * Surfaces the schedule's pickup booking rule as a passenger DTO
     * — phone, URL, prior notice — when the arrival's pickup is
     * on-demand (TAD). Returns null on regular fixed-route arrivals
     * so the kiosk doesn't render a CTA where none applies.
     *
     * Drop-off bookings are intentionally not surfaced: a passenger
     * arriving at a stop has already booked, and rendering an
     * "alighting reservation" message at boarding time confuses more
     * than it helps.
     */
    static DisplayState.BookingInfo resolveBookingInfo(Schedule schedule) {
        BookingRule rule = schedule.getPickupBookingRule();
        if (rule == null) {return null;}
        // Only surface when the pickup type signals "on-demand" — a
        // booking rule attached to a regular pickup_type=0 trip is
        // unusual but legal in the spec and shouldn't trigger a CTA.
        short pt = schedule.getPickupType();
        if (pt != 2 && pt != 3) {return null;}
        return new DisplayState.BookingInfo(
                rule.getPhone(),
                rule.getBookingUrl(),
                rule.getInfoUrl(),
                rule.getMessage(),
                rule.getPriorNoticeDurationMin());
    }

    /**
     * Resolves the effective bikes-allowed policy for an arrival,
     * mirroring {@link #resolveWheelchair}.
     */
    static BikesAllowed resolveBikes(Schedule schedule, Itinerary itinerary) {
        if (schedule.getBikesAllowedOverride() != null) {
            return schedule.getBikesAllowedOverride()
                    ? BikesAllowed.ALLOWED
                    : BikesAllowed.NOT_ALLOWED;
        }
        return itinerary.getBikesAllowedDefault() == null
                ? BikesAllowed.UNKNOWN
                : itinerary.getBikesAllowedDefault();
    }

    /**
     * Resolves the effective wheelchair accessibility for an arrival.
     * Priority: schedule override > itinerary default > UNKNOWN. Keeps
     * the kiosk three-state pictogram in sync with what the operator
     * actually published in the feed.
     */
    static WheelchairAccess resolveWheelchair(Schedule schedule, Itinerary itinerary) {
        if (schedule.getWheelchairOverride() != null) {
            return schedule.getWheelchairOverride()
                    ? WheelchairAccess.ACCESSIBLE
                    : WheelchairAccess.NOT_ACCESSIBLE;
        }
        return itinerary.getWheelchairDefault() == null
                ? WheelchairAccess.UNKNOWN
                : itinerary.getWheelchairDefault();
    }

    static String resolveStopHeadsign(Itinerary itinerary, UUID stopId) {
        if (itinerary.getItineraryStops() == null) {return null;}
        for (var is : itinerary.getItineraryStops()) {
            if (is.getStop() != null && stopId.equals(is.getStop().getId())) {
                String headsign = is.getStopHeadsign();
                return (headsign == null || headsign.isBlank()) ? null : headsign;
            }
        }
        return null;
    }

    /**
     * Wraps a {@link Line} into a {@link LineInfo}, substituting code
     * and name for their translated equivalents when the feed provides
     * them. The fallback is the original value, so a partially-
     * translated feed still renders without holes.
     */
    static LineInfo translatedLineInfo(Line line, TranslationLookup translations) {
        if (translations.isEmpty()) {
            return LineInfo.from(line);
        }
        String code = translations.resolveOr("routes", line.getExternalId(), "route_short_name", line.getCode());
        String name = translations.resolveOr("routes", line.getExternalId(), "route_long_name", line.getName());
        return new LineInfo(line.getId(), code, name, line.getColor(), line.getTextColor());
    }

    /**
     * Resolves the itinerary's terminus name, applying the translation
     * for the underlying terminus stop when one exists. Used as the
     * final fallback for {@code destination} when neither a per-stop
     * {@code stop_headsign} nor a trip-level {@code trip_headsign}
     * translation is available.
     */
    static String resolveTranslatedTerminus(Itinerary itinerary, TranslationLookup translations) {
        if (itinerary.getItineraryStops() == null || itinerary.getItineraryStops().isEmpty()) {
            return itinerary.getTerminusName();
        }
        Stop terminus = itinerary.getItineraryStops().getLast().getStop();
        if (terminus == null) {
            return itinerary.getTerminusName();
        }
        return translations.resolveOr("stops", terminus.getExternalId(), "stop_name", terminus.getName());
    }
}
