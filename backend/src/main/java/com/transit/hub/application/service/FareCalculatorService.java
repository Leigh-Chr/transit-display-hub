package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.FareCalculationResponse;
import com.transit.hub.application.dto.response.FareCalculationResponse.V1Option;
import com.transit.hub.application.dto.response.FareCalculationResponse.V2Option;
import com.transit.hub.domain.model.Area;
import com.transit.hub.domain.model.FareAttribute;
import com.transit.hub.domain.model.FareLegRule;
import com.transit.hub.domain.model.FareRule;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.infrastructure.persistence.AreaRepository;
import com.transit.hub.infrastructure.persistence.FareAttributeRepository;
import com.transit.hub.infrastructure.persistence.FareLegRuleRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.jspecify.annotations.Nullable;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Calculates the GTFS fares applicable for a trip between two stops.
 * Combines two pipelines because feeds in the wild ship one or both:
 *
 * <ul>
 *   <li><b>V1</b>: scans {@link FareAttribute}s and matches their
 *       {@link FareRule}s on {@code origin_id} / {@code destination_id}
 *       / {@code contains_id} against the stops' {@code zone_id}.</li>
 *   <li><b>V2</b>: maps each stop to its {@link Area} memberships then
 *       returns every {@link FareLegRule} whose
 *       {@code (from_area, to_area)} pair matches, sorted by
 *       {@code rule_priority}.</li>
 * </ul>
 *
 * Timeframes and rider categories filtering is left to the caller for
 * now — the response carries the raw rule fields so a consumer that
 * cares can post-filter without a second round-trip.
 */
@Service
@RequiredArgsConstructor
public class FareCalculatorService {

    private final StopRepository stopRepository;
    private final FareAttributeRepository fareAttributeRepository;
    private final FareLegRuleRepository fareLegRuleRepository;
    private final AreaRepository areaRepository;
    private final MeterRegistry meterRegistry;

    /** Built once at @PostConstruct rather than rebuilt on every
     *  /api/fares/calculate request — Timer.builder().register()
     *  was previously re-traversing the meter registry on every hot-path
     *  call, allocating a new builder per request for no gain (Micrometer
     *  returns the existing meter when it already exists, but the
     *  allocation + lookup is still wasted). */
    @SuppressWarnings("NullAway.Init") // assigned by @PostConstruct before first calculate() call
    private Timer calculationTimer;

    @jakarta.annotation.PostConstruct
    void registerMeters() {
        calculationTimer = Timer.builder("fare.calculation.duration")
                .description("Wall-clock duration of a /api/fares/calculate request")
                .publishPercentiles(0.5, 0.95, 0.99)
                .register(meterRegistry);
    }

    @Transactional(readOnly = true)
    public Optional<FareCalculationResponse> calculate(UUID fromStopId, UUID toStopId) {
        Timer.Sample sample = Timer.start(meterRegistry);
        try {
            Optional<Stop> fromOpt = stopRepository.findById(fromStopId);
            Optional<Stop> toOpt = stopRepository.findById(toStopId);
            if (fromOpt.isEmpty() || toOpt.isEmpty()) {
                return Optional.empty();
            }
            Stop from = fromOpt.get();
            Stop to = toOpt.get();

            List<V1Option> v1 = calculateV1(from, to);
            List<V2Option> v2 = calculateV2(from, to);

            return Optional.of(new FareCalculationResponse(
                    from.getId().toString(), from.getName(), from.getZoneId(),
                    to.getId().toString(), to.getName(), to.getZoneId(),
                    v1, v2
            ));
        } finally {
            sample.stop(calculationTimer);
        }
    }

    /** GTFS Fares V1 — match {@code FareRule.origin_id/destination_id/contains_id}
     *  against the stops' {@code zone_id}. Per spec, a fare attribute's
     *  rules are OR-ed together: any rule that matches qualifies the
     *  attribute. We keep every match so the caller can render the
     *  cheapest. */
    private List<V1Option> calculateV1(Stop from, Stop to) {
        if (from.getZoneId() == null && to.getZoneId() == null) {
            return List.of();
        }
        List<V1Option> options = new ArrayList<>();
        for (FareAttribute attr : fareAttributeRepository.findAllWithRules()) {
            if (attr.getRules() == null || attr.getRules().isEmpty()) {
                // No rules: applies network-wide. Treated as applicable.
                options.add(toV1Option(attr, null, null, null));
                continue;
            }
            for (FareRule r : attr.getRules()) {
                boolean originMatches = r.getOriginId() == null
                        || (from.getZoneId() != null && from.getZoneId().equals(r.getOriginId()));
                boolean destinationMatches = r.getDestinationId() == null
                        || (to.getZoneId() != null && to.getZoneId().equals(r.getDestinationId()));
                if (originMatches && destinationMatches) {
                    options.add(toV1Option(attr,
                            r.getRoute() != null ? r.getRoute().getCode() : null,
                            r.getOriginId(), r.getDestinationId()));
                }
            }
        }
        return options.stream()
                .sorted(Comparator.comparing(V1Option::price,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    private V1Option toV1Option(FareAttribute attr, @Nullable String routeCode,
                                @Nullable String matchedOrigin, @Nullable String matchedDest) {
        return new V1Option(
                attr.getExternalId(),
                attr.getPrice(),
                attr.getCurrency(),
                attr.getPaymentMethod() != null ? attr.getPaymentMethod().name() : null,
                attr.getTransfers(),
                attr.getTransferDuration(),
                attr.getAgency() != null ? attr.getAgency().getName() : null,
                routeCode,
                matchedOrigin,
                matchedDest
        );
    }

    /** GTFS Fares V2 — map each stop to its {@link Area}s, then keep
     *  every {@link FareLegRule} whose (from_area, to_area) pair
     *  matches. {@code rule_priority} sorts the results for the
     *  caller. */
    private List<V2Option> calculateV2(Stop from, Stop to) {
        Set<UUID> fromAreaIds = areaRepository.findByStopId(from.getId()).stream()
                .map(Area::getId).collect(Collectors.toSet());
        Set<UUID> toAreaIds = areaRepository.findByStopId(to.getId()).stream()
                .map(Area::getId).collect(Collectors.toSet());

        if (fromAreaIds.isEmpty() && toAreaIds.isEmpty()) {
            return List.of();
        }

        List<V2Option> options = new ArrayList<>();
        for (FareLegRule rule : fareLegRuleRepository.findAllWithRefs()) {
            UUID ruleFromArea = rule.getFromArea() != null ? rule.getFromArea().getId() : null;
            UUID ruleToArea = rule.getToArea() != null ? rule.getToArea().getId() : null;

            // Spec: a null leg_rule.from_area matches any origin, ditto
            // for to_area. So a rule with both nulls matches every trip.
            boolean fromMatches = ruleFromArea == null || fromAreaIds.contains(ruleFromArea);
            boolean toMatches = ruleToArea == null || toAreaIds.contains(ruleToArea);
            if (!fromMatches || !toMatches) {continue;}

            options.add(new V2Option(
                    rule.getLegGroupId(),
                    rule.getFareProduct() != null ? rule.getFareProduct().getExternalId() : null,
                    rule.getFareProduct() != null ? rule.getFareProduct().getName() : null,
                    rule.getFareProduct() != null ? rule.getFareProduct().getAmount() : null,
                    rule.getFareProduct() != null ? rule.getFareProduct().getCurrency() : null,
                    rule.getFromArea() != null ? rule.getFromArea().getExternalId() : null,
                    rule.getFromArea() != null ? rule.getFromArea().getName() : null,
                    rule.getToArea() != null ? rule.getToArea().getExternalId() : null,
                    rule.getToArea() != null ? rule.getToArea().getName() : null,
                    rule.getRulePriority(),
                    rule.getNetworkId(),
                    rule.getFromTimeframeGroupId(),
                    rule.getToTimeframeGroupId()
            ));
        }
        // Sort by priority asc (lowest = highest), nulls last
        return options.stream()
                .sorted(Comparator.comparing(V2Option::rulePriority,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }
}
