package com.transit.hub.infrastructure.seed.gtfs.sections;

import com.transit.hub.domain.model.Area;
import com.transit.hub.domain.model.FareLegJoinRule;
import com.transit.hub.domain.model.FareLegRule;
import com.transit.hub.domain.model.FareMedia;
import com.transit.hub.domain.model.FareProduct;
import com.transit.hub.domain.model.FareTransferRule;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Network;
import com.transit.hub.domain.model.RiderCategory;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.Timeframe;
import com.transit.hub.infrastructure.persistence.AreaRepository;
import com.transit.hub.infrastructure.persistence.FareLegJoinRuleRepository;
import com.transit.hub.infrastructure.persistence.FareLegRuleRepository;
import com.transit.hub.infrastructure.persistence.FareMediaRepository;
import com.transit.hub.infrastructure.persistence.FareProductRepository;
import com.transit.hub.infrastructure.persistence.FareTransferRuleRepository;
import com.transit.hub.infrastructure.persistence.NetworkRepository;
import com.transit.hub.infrastructure.persistence.RiderCategoryRepository;
import com.transit.hub.infrastructure.persistence.TimeframeRepository;
import com.transit.hub.infrastructure.seed.gtfs.model.StopImport;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.isBlank;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseIntOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseShortOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.truncate;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.openCsv;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.optional;

/**
 * Imports the GTFS Fares v2 family — areas, timeframes, fare
 * products, leg rules, transfer rules — in dependency order.
 * Each table wipes and re-inserts; cross-references resolve via
 * the maps built up as we go.
 *
 * <p>v2 coexists with v1 (which {@link FareV1Importer} populates):
 * feeds in transition often ship both, and the kiosk can prefer
 * v2 when present without dropping v1 data.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class FareV2Importer {

    private final NetworkRepository networkRepository;
    private final FareMediaRepository fareMediaRepository;
    private final RiderCategoryRepository riderCategoryRepository;
    private final AreaRepository areaRepository;
    private final TimeframeRepository timeframeRepository;
    private final FareProductRepository fareProductRepository;
    private final FareLegRuleRepository fareLegRuleRepository;
    private final FareTransferRuleRepository fareTransferRuleRepository;
    private final FareLegJoinRuleRepository fareLegJoinRuleRepository;

    /**
     * Wipes and re-imports all Fares v2 tables in dependency order.
     *
     * @param workDir       directory containing the extracted GTFS files
     * @param stopImport    stop index built by {@link StopImporter}
     * @param linesByGtfsId route index built by {@link RouteImporter}
     */
    public void importFaresV2(Path workDir, StopImport stopImport,
                              Map<String, Line> linesByGtfsId) throws IOException {
        // Order matters: leg rules reference areas / products, transfer
        // rules reference products. Wipe the dependents first so FK
        // SET NULL does not fire spuriously during the rebuild.
        fareLegJoinRuleRepository.deleteAllInBatch();
        fareTransferRuleRepository.deleteAllInBatch();
        fareLegRuleRepository.deleteAllInBatch();
        fareProductRepository.deleteAllInBatch();
        riderCategoryRepository.deleteAllInBatch();
        fareMediaRepository.deleteAllInBatch();
        timeframeRepository.deleteAllInBatch();
        areaRepository.deleteAllInBatch();
        networkRepository.deleteAllInBatch();
        fareTransferRuleRepository.flush();

        importNetworks(workDir.resolve("networks.txt"),
                workDir.resolve("route_networks.txt"), linesByGtfsId);
        importFareMedia(workDir.resolve("fare_media.txt"));
        importRiderCategories(workDir.resolve("rider_categories.txt"));
        Map<String, Area> areasByExternalId = importAreas(workDir.resolve("areas.txt"),
                workDir.resolve("stop_areas.txt"), stopImport);
        importTimeframes(workDir.resolve("timeframes.txt"));
        Map<String, FareProduct> productsByExternalId =
                importFareProducts(workDir.resolve("fare_products.txt"));
        importFareLegRules(workDir.resolve("fare_leg_rules.txt"),
                areasByExternalId, productsByExternalId);
        importFareTransferRules(workDir.resolve("fare_transfer_rules.txt"), productsByExternalId);
        importFareLegJoinRules(workDir.resolve("fare_leg_join_rules.txt"), stopImport);
    }

    private void importNetworks(Path networksFile, Path routeNetworksFile,
                                Map<String, Line> linesByGtfsId) throws IOException {
        Map<String, Network> result = new HashMap<>();
        if (!Files.exists(networksFile)) {
            log.info("GTFS import: networks.txt missing, skipping");
            return;
        }
        try (CSVParser parser = openCsv(networksFile)) {
            for (CSVRecord record : parser) {
                String externalId = optional(record, "network_id");
                if (isBlank(externalId)) {continue;}
                Network network = Network.builder()
                        .externalId(truncate(externalId, 100))
                        .name(truncate(optional(record, "network_name"), 200))
                        .build();
                result.put(externalId, network);
            }
        }
        if (result.isEmpty()) {
            return;
        }

        // Resolve route memberships before persist; the M2M join rows
        // ride along with the parent saveAll.
        if (Files.exists(routeNetworksFile)) {
            try (CSVParser parser = openCsv(routeNetworksFile)) {
                for (CSVRecord record : parser) {
                    String networkExtId = optional(record, "network_id");
                    String routeGtfsId = optional(record, "route_id");
                    Network network = result.get(networkExtId);
                    Line line = linesByGtfsId.get(routeGtfsId);
                    if (network != null && line != null) {
                        network.getRoutes().add(line);
                    }
                }
            }
        }
        networkRepository.saveAll(result.values());
        log.info("GTFS import: {} networks persisted", result.size());
    }

    private void importFareMedia(Path mediaFile) throws IOException {
        if (!Files.exists(mediaFile)) {
            log.info("GTFS import: fare_media.txt missing, skipping");
            return;
        }
        List<FareMedia> batch = new ArrayList<>();
        try (CSVParser parser = openCsv(mediaFile)) {
            for (CSVRecord record : parser) {
                String externalId = optional(record, "fare_media_id");
                if (isBlank(externalId)) {continue;}
                batch.add(FareMedia.builder()
                        .externalId(truncate(externalId, 100))
                        .name(truncate(optional(record, "fare_media_name"), 200))
                        .mediaType(parseShortOrNull(optional(record, "fare_media_type")))
                        .build());
            }
        }
        fareMediaRepository.saveAll(batch);
        log.info("GTFS import: {} fare media rows persisted", batch.size());
    }

    private void importRiderCategories(Path file) throws IOException {
        if (!Files.exists(file)) {
            log.info("GTFS import: rider_categories.txt missing, skipping");
            return;
        }
        List<RiderCategory> batch = new ArrayList<>();
        try (CSVParser parser = openCsv(file)) {
            for (CSVRecord record : parser) {
                String externalId = optional(record, "rider_category_id");
                if (isBlank(externalId)) {continue;}
                batch.add(RiderCategory.builder()
                        .externalId(truncate(externalId, 100))
                        .name(truncate(optional(record, "rider_category_name"), 200))
                        .isDefaultFareCategory(parseShortOrNull(
                                optional(record, "is_default_fare_category")))
                        .eligibilityUrl(truncate(optional(record, "eligibility_url"), 500))
                        .build());
            }
        }
        riderCategoryRepository.saveAll(batch);
        log.info("GTFS import: {} rider categories persisted", batch.size());
    }

    private Map<String, Area> importAreas(Path areasFile, Path stopAreasFile,
                                          StopImport stopImport) throws IOException {
        Map<String, Area> result = new HashMap<>();
        if (!Files.exists(areasFile)) {
            log.info("GTFS import: areas.txt missing, skipping Fares v2 areas");
            return result;
        }
        try (CSVParser parser = openCsv(areasFile)) {
            for (CSVRecord record : parser) {
                String externalId = optional(record, "area_id");
                if (isBlank(externalId)) {continue;}
                Area area = Area.builder()
                        .externalId(truncate(externalId, 100))
                        .name(truncate(optional(record, "area_name"), 200))
                        .build();
                result.put(externalId, area);
            }
        }
        if (result.isEmpty()) {
            return result;
        }

        // Resolve stop memberships before persist so the @ManyToMany
        // join rows go in atomically with their parents.
        if (Files.exists(stopAreasFile)) {
            try (CSVParser parser = openCsv(stopAreasFile)) {
                for (CSVRecord record : parser) {
                    String areaId = optional(record, "area_id");
                    String stopGtfsId = optional(record, "stop_id");
                    Area area = result.get(areaId);
                    if (area == null || isBlank(stopGtfsId)) {continue;}
                    Stop stop = stopImport.stopsByGtfsId().get(stopGtfsId);
                    if (stop != null) {
                        area.getStops().add(stop);
                    }
                }
            }
        }
        areaRepository.saveAll(result.values());
        log.info("GTFS import: {} fares-v2 areas persisted", result.size());
        return result;
    }

    private void importTimeframes(Path timeframesFile) throws IOException {
        if (!Files.exists(timeframesFile)) {
            log.info("GTFS import: timeframes.txt missing, skipping");
            return;
        }
        List<Timeframe> batch = new ArrayList<>();
        try (CSVParser parser = openCsv(timeframesFile)) {
            for (CSVRecord record : parser) {
                String groupId = optional(record, "timeframe_group_id");
                if (isBlank(groupId)) {continue;}
                batch.add(Timeframe.builder()
                        .timeframeGroupId(truncate(groupId, 100))
                        .startTime(com.transit.hub.infrastructure.seed.gtfs.GtfsParse
                                .parseGtfsTime(optional(record, "start_time")))
                        .endTime(com.transit.hub.infrastructure.seed.gtfs.GtfsParse
                                .parseGtfsTime(optional(record, "end_time")))
                        .serviceId(truncate(optional(record, "service_id"), 100))
                        .build());
            }
        }
        timeframeRepository.saveAll(batch);
        log.info("GTFS import: {} timeframe windows persisted", batch.size());
    }

    private Map<String, FareProduct> importFareProducts(Path productsFile) throws IOException {
        Map<String, FareProduct> result = new HashMap<>();
        if (!Files.exists(productsFile)) {
            log.info("GTFS import: fare_products.txt missing, skipping");
            return result;
        }
        try (CSVParser parser = openCsv(productsFile)) {
            for (CSVRecord record : parser) {
                String externalId = optional(record, "fare_product_id");
                String amountRaw = optional(record, "amount");
                String currency = optional(record, "currency");
                if (isBlank(externalId) || isBlank(amountRaw) || isBlank(currency)) {continue;}
                BigDecimal amount;
                try {
                    amount = new BigDecimal(amountRaw.trim());
                } catch (NumberFormatException e) {
                    log.warn("GTFS import: fare_product {} has invalid amount '{}', skipping",
                            externalId, amountRaw);
                    continue;
                }
                FareProduct product = FareProduct.builder()
                        .externalId(truncate(externalId, 100))
                        .name(truncate(optional(record, "fare_product_name"), 200))
                        .fareMediaId(truncate(optional(record, "fare_media_id"), 100))
                        .riderCategoryId(truncate(optional(record, "rider_category_id"), 100))
                        .amount(amount)
                        .currency(truncate(currency, 3))
                        .build();
                result.put(externalId, product);
            }
        }
        fareProductRepository.saveAll(result.values());
        log.info("GTFS import: {} fare products persisted", result.size());
        return result;
    }

    private void importFareLegRules(Path legRulesFile,
                                    Map<String, Area> areasByExternalId,
                                    Map<String, FareProduct> productsByExternalId)
            throws IOException {
        if (!Files.exists(legRulesFile)) {
            log.info("GTFS import: fare_leg_rules.txt missing, skipping");
            return;
        }
        List<FareLegRule> batch = new ArrayList<>();
        try (CSVParser parser = openCsv(legRulesFile)) {
            for (CSVRecord record : parser) {
                FareLegRule rule = FareLegRule.builder()
                        .legGroupId(truncate(optional(record, "leg_group_id"), 100))
                        .networkId(truncate(optional(record, "network_id"), 100))
                        .fromArea(areasByExternalId.get(optional(record, "from_area_id")))
                        .toArea(areasByExternalId.get(optional(record, "to_area_id")))
                        .fromTimeframeGroupId(truncate(
                                optional(record, "from_timeframe_group_id"), 100))
                        .toTimeframeGroupId(truncate(
                                optional(record, "to_timeframe_group_id"), 100))
                        .fareProduct(productsByExternalId.get(optional(record, "fare_product_id")))
                        .rulePriority(parseIntOrNull(optional(record, "rule_priority")))
                        .build();
                batch.add(rule);
            }
        }
        fareLegRuleRepository.saveAll(batch);
        log.info("GTFS import: {} fare leg rules persisted", batch.size());
    }

    private void importFareTransferRules(Path transferRulesFile,
                                         Map<String, FareProduct> productsByExternalId)
            throws IOException {
        if (!Files.exists(transferRulesFile)) {
            log.info("GTFS import: fare_transfer_rules.txt missing, skipping");
            return;
        }
        List<FareTransferRule> batch = new ArrayList<>();
        try (CSVParser parser = openCsv(transferRulesFile)) {
            for (CSVRecord record : parser) {
                String typeRaw = optional(record, "fare_transfer_type");
                if (isBlank(typeRaw)) {continue;}
                short transferType;
                try {
                    transferType = Short.parseShort(typeRaw.trim());
                } catch (NumberFormatException e) {
                    continue;
                }
                FareTransferRule rule = FareTransferRule.builder()
                        .fromLegGroupId(truncate(optional(record, "from_leg_group_id"), 100))
                        .toLegGroupId(truncate(optional(record, "to_leg_group_id"), 100))
                        .transferCount(parseIntOrNull(optional(record, "transfer_count")))
                        .durationLimit(parseIntOrNull(optional(record, "duration_limit")))
                        .durationLimitType(parseShortOrNull(optional(record, "duration_limit_type")))
                        .fareTransferType(transferType)
                        .fareProduct(productsByExternalId.get(optional(record, "fare_product_id")))
                        .minutesBeforeToStartBoardingTime(
                                parseIntOrNull(optional(record,
                                        "minutes_before_to_start_boarding_time")))
                        .minutesAfterToStartBoardingTime(
                                parseIntOrNull(optional(record,
                                        "minutes_after_to_start_boarding_time")))
                        .build();
                batch.add(rule);
            }
        }
        fareTransferRuleRepository.saveAll(batch);
        log.info("GTFS import: {} fare transfer rules persisted", batch.size());
    }

    private void importFareLegJoinRules(Path joinRulesFile, StopImport stopImport)
            throws IOException {
        if (!Files.exists(joinRulesFile)) {
            log.info("GTFS import: fare_leg_join_rules.txt missing, skipping");
            return;
        }
        List<FareLegJoinRule> batch = new ArrayList<>();
        try (CSVParser parser = openCsv(joinRulesFile)) {
            for (CSVRecord record : parser) {
                // Canonical (post-2024) layout: leg_group_id + leg_sequence
                // + preceding_trip_transfer_limit. Legacy MobilityData
                // layout: from/to_network/stop pairs. We accept both.
                String legGroupId = optional(record, "leg_group_id");
                Integer legSequence = parseIntOrNull(optional(record, "leg_sequence"));
                Integer precedingLimit = parseIntOrNull(
                        optional(record, "preceding_trip_transfer_limit"));

                String fromStopId = optional(record, "from_stop_id");
                String toStopId = optional(record, "to_stop_id");
                String fromNet = optional(record, "from_network_id");
                String toNet = optional(record, "to_network_id");
                Stop fromStop = isBlank(fromStopId) ? null
                        : stopImport.stopsByGtfsId().get(fromStopId);
                Stop toStop = isBlank(toStopId) ? null
                        : stopImport.stopsByGtfsId().get(toStopId);
                boolean canonical = !isBlank(legGroupId) || legSequence != null;
                boolean legacy = !isBlank(fromNet) || !isBlank(toNet)
                        || fromStop != null || toStop != null;
                if (!canonical && !legacy) {
                    continue;
                }
                batch.add(FareLegJoinRule.builder()
                        .legGroupId(truncate(legGroupId, 100))
                        .legSequence(legSequence)
                        .precedingTripTransferLimit(precedingLimit)
                        .fromNetworkId(truncate(fromNet, 100))
                        .toNetworkId(truncate(toNet, 100))
                        .fromStop(fromStop)
                        .toStop(toStop)
                        .build());
            }
        }
        fareLegJoinRuleRepository.saveAll(batch);
        log.info("GTFS import: {} fare leg join rules persisted", batch.size());
    }
}
