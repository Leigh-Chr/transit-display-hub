package com.transit.hub.infrastructure.seed.gtfs.sections;

import com.transit.hub.domain.model.Agency;
import com.transit.hub.domain.model.FareAttribute;
import com.transit.hub.domain.model.FareRule;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.enums.FarePaymentMethod;
import com.transit.hub.infrastructure.persistence.FareAttributeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.isBlank;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseInt;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseIntOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.truncate;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.openCsv;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.optional;
import static com.transit.hub.infrastructure.seed.gtfs.sections.RouteImporter.resolveAgency;

/**
 * Reads GTFS Fares v1 ({@code fare_attributes.txt} + {@code fare_rules.txt})
 * and replaces both tables on every import. When {@code fare_attributes.txt}
 * is missing the entire fare pipeline is skipped rather than persisting
 * orphan rules.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class FareV1Importer {

    private final FareAttributeRepository fareAttributeRepository;

    /**
     * Wipes fare_attributes (and cascaded fare_rules) and re-imports.
     *
     * @param workDir          directory containing the extracted GTFS files
     * @param linesByGtfsId    route index built by {@link RouteImporter}
     * @param agenciesByGtfsId agency index built by {@link AgencyImporter}
     */
    public void importFares(Path workDir, Map<String, Line> linesByGtfsId,
                            Map<String, Agency> agenciesByGtfsId) throws IOException {
        fareAttributeRepository.deleteAllInBatch();
        fareAttributeRepository.flush();

        Path fareAttributesFile = workDir.resolve("fare_attributes.txt");
        if (!Files.exists(fareAttributesFile)) {
            log.info("GTFS import: fare_attributes.txt missing, skipping fares");
            return;
        }

        Map<String, FareAttribute> attributesByGtfsId = new HashMap<>();
        int skippedAttrs = 0;
        try (CSVParser parser = openCsv(fareAttributesFile)) {
            for (CSVRecord record : parser) {
                String fareId = optional(record, "fare_id");
                String priceRaw = optional(record, "price");
                String currency = optional(record, "currency_type");
                if (isBlank(fareId) || isBlank(priceRaw) || isBlank(currency)) {
                    skippedAttrs++;
                    continue;
                }
                BigDecimal price;
                try {
                    price = new BigDecimal(priceRaw.trim());
                } catch (NumberFormatException e) {
                    skippedAttrs++;
                    continue;
                }
                int paymentCode = parseInt(optional(record, "payment_method"), 0);
                Integer transfers = parseTransfersField(optional(record, "transfers"));
                Integer transferDuration = parseIntOrNull(optional(record, "transfer_duration"));
                Agency agency = resolveAgency(optional(record, "agency_id"), agenciesByGtfsId);

                FareAttribute attr = FareAttribute.builder()
                        .externalId(truncate(fareId.trim(), 100))
                        .price(price)
                        .currency(truncate(currency.trim().toUpperCase(java.util.Locale.ROOT), 3))
                        .paymentMethod(FarePaymentMethod.fromGtfsCode(paymentCode))
                        .transfers(transfers)
                        .transferDuration(transferDuration)
                        .agency(agency)
                        .build();
                attributesByGtfsId.put(fareId, fareAttributeRepository.save(attr));
            }
        }
        if (skippedAttrs > 0) {
            log.warn("GTFS import: skipped {} malformed fare_attributes.txt rows", skippedAttrs);
        }
        log.info("GTFS import: {} fare attributes persisted", attributesByGtfsId.size());

        // fare_rules.txt is optional — when absent, fare_attributes alone
        // describe a flat fare that applies to every trip in the feed.
        Path fareRulesFile = workDir.resolve("fare_rules.txt");
        if (!Files.exists(fareRulesFile)) {
            log.info("GTFS import: fare_rules.txt missing, fare attributes will apply unconditionally");
            return;
        }
        int rulesPersisted = 0;
        int skippedRules = 0;
        try (CSVParser parser = openCsv(fareRulesFile)) {
            for (CSVRecord record : parser) {
                String fareId = optional(record, "fare_id");
                if (isBlank(fareId)) {
                    skippedRules++;
                    continue;
                }
                FareAttribute attr = attributesByGtfsId.get(fareId);
                if (attr == null) {
                    skippedRules++;
                    continue;
                }
                Line route = null;
                String routeId = optional(record, "route_id");
                if (!isBlank(routeId)) {
                    route = linesByGtfsId.get(routeId);
                }
                FareRule rule = FareRule.builder()
                        .fareAttribute(attr)
                        .route(route)
                        .originId(truncate(optional(record, "origin_id"), 100))
                        .destinationId(truncate(optional(record, "destination_id"), 100))
                        .containsId(truncate(optional(record, "contains_id"), 100))
                        .build();
                attr.getRules().add(rule);
                rulesPersisted++;
            }
        }
        // Attributes already saved; cascade on the rules collection picks
        // up the new rows when we save the parent again.
        fareAttributeRepository.saveAll(attributesByGtfsId.values());
        if (skippedRules > 0) {
            log.warn("GTFS import: skipped {} fare_rules.txt rows referencing unknown fare_id",
                    skippedRules);
        }
        log.info("GTFS import: {} fare rules persisted", rulesPersisted);
    }

    /**
     * GTFS encodes "unlimited transfers" by leaving the cell empty —
     * this differs from "0 transfers" which is "no transfers allowed".
     * Returning {@code null} preserves that distinction.
     */
    private static @Nullable Integer parseTransfersField(@Nullable String raw) {
        if (raw == null || raw.isBlank()) { return null; }
        return parseIntOrNull(raw.trim());
    }
}
