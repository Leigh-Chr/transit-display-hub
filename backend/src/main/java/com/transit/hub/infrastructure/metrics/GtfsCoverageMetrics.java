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
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tags;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

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

    @Autowired private MeterRegistry registry;
    @Autowired private TranslationRepository translationRepository;
    @Autowired private AttributionRepository attributionRepository;
    @Autowired private PathwayRepository pathwayRepository;
    @Autowired private StationLevelRepository stationLevelRepository;
    @Autowired private FlexStopTimeRepository flexStopTimeRepository;
    @Autowired private LocationRepository locationRepository;
    @Autowired private LocationGroupRepository locationGroupRepository;
    @Autowired private BookingRuleRepository bookingRuleRepository;
    @Autowired private AreaRepository areaRepository;
    @Autowired private NetworkRepository networkRepository;
    @Autowired private TimeframeRepository timeframeRepository;
    @Autowired private FareLegRuleRepository fareLegRuleRepository;
    @Autowired private FareTransferRuleRepository fareTransferRuleRepository;
    @Autowired private FareLegJoinRuleRepository fareLegJoinRuleRepository;
    @Autowired private RiderCategoryRepository riderCategoryRepository;

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

    private void bind(String kind, java.util.function.Supplier<Long> counter) {
        registry.gauge("gtfs.entity.count", Tags.of("kind", kind),
                counter, s -> s.get().doubleValue());
    }
}
