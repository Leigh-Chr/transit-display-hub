package com.transit.hub.infrastructure.metrics;

import com.transit.hub.infrastructure.persistence.AreaRepository;
import com.transit.hub.infrastructure.persistence.AttributionRepository;
import com.transit.hub.infrastructure.persistence.BookingRuleRepository;
import com.transit.hub.infrastructure.persistence.FareLegJoinRuleRepository;
import com.transit.hub.infrastructure.persistence.FareLegRuleRepository;
import com.transit.hub.infrastructure.persistence.FareTransferRuleRepository;
import com.transit.hub.infrastructure.persistence.FlexStopTimeRepository;
import com.transit.hub.infrastructure.persistence.LocationGroupRepository;
import com.transit.hub.infrastructure.persistence.LocationRepository;
import com.transit.hub.infrastructure.persistence.NetworkRepository;
import com.transit.hub.infrastructure.persistence.PathwayRepository;
import com.transit.hub.infrastructure.persistence.RiderCategoryRepository;
import com.transit.hub.infrastructure.persistence.StationLevelRepository;
import com.transit.hub.infrastructure.persistence.TimeframeRepository;
import com.transit.hub.infrastructure.persistence.TranslationRepository;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.function.Supplier;

/**
 * Exposes a per-entity coverage gauge {@code gtfs.entity.count{kind=…}}
 * on the Prometheus scrape, one tag value per entity family that the
 * project models. Lets Grafana track "how much of the spec does the
 * imported feed actually populate" without scraping the DB.
 *
 * <p>Gauges are bound to repository {@code count()} calls so they
 * reflect the live state on every scrape (Micrometer caches between
 * scrapes; the count itself is cheap on indexed tables).
 */
@Component
@RequiredArgsConstructor
public class GtfsCoverageMetrics {

    private final MeterRegistry registry;
    private final TranslationRepository translationRepository;
    private final AttributionRepository attributionRepository;
    private final PathwayRepository pathwayRepository;
    private final StationLevelRepository stationLevelRepository;
    private final FlexStopTimeRepository flexStopTimeRepository;
    private final LocationRepository locationRepository;
    private final LocationGroupRepository locationGroupRepository;
    private final BookingRuleRepository bookingRuleRepository;
    private final AreaRepository areaRepository;
    private final NetworkRepository networkRepository;
    private final TimeframeRepository timeframeRepository;
    private final FareLegRuleRepository fareLegRuleRepository;
    private final FareTransferRuleRepository fareTransferRuleRepository;
    private final FareLegJoinRuleRepository fareLegJoinRuleRepository;
    private final RiderCategoryRepository riderCategoryRepository;

    /** Bind one gauge per entity family at startup. {@code @EventListener}
     *  on {@code ApplicationReadyEvent} runs after Flyway migrations + the
     *  initial GTFS import, so the first scrape returns ground-truth
     *  counts. */
    @EventListener(ApplicationReadyEvent.class)
    public void bindGauges() {
        bind("translations", translationRepository::count);
        bind("attributions", attributionRepository::count);
        bind("pathways", pathwayRepository::count);
        bind("levels", stationLevelRepository::count);
        bind("flex_stop_times", flexStopTimeRepository::count);
        bind("locations", locationRepository::count);
        bind("location_groups", locationGroupRepository::count);
        bind("booking_rules", bookingRuleRepository::count);
        bind("areas", areaRepository::count);
        bind("networks", networkRepository::count);
        bind("timeframes", timeframeRepository::count);
        bind("fare_leg_rules", fareLegRuleRepository::count);
        bind("fare_transfer_rules", fareTransferRuleRepository::count);
        bind("fare_leg_join_rules", fareLegJoinRuleRepository::count);
        bind("rider_categories", riderCategoryRepository::count);
    }

    /** Register a {@link Gauge} backed by the supplied counter. Uses
     *  {@link Gauge#builder(String, Supplier)} (not the
     *  {@code MeterRegistry.gauge} convenience overload) because the
     *  builder keeps a strong reference to the supplier — the latter
     *  retains only a weak reference to the state object, which lets
     *  the JVM GC the lambda and the gauge starts returning {@code NaN}
     *  on the next scrape. */
    private void bind(String kind, Supplier<Long> counter) {
        Gauge.builder("gtfs.entity.count", counter)
                .tag("kind", kind)
                .register(registry);
    }
}
