package com.transit.hub.infrastructure.seed.gtfs.sections;

import com.transit.hub.domain.model.BookingRule;
import com.transit.hub.domain.model.enums.BookingType;
import com.transit.hub.infrastructure.persistence.BookingRuleRepository;
import com.transit.hub.infrastructure.seed.gtfs.GtfsParse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.Map;

import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.isBlank;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseIntOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.truncate;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.openCsv;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.optional;

/**
 * Reads {@code booking_rules.txt} and replaces the {@link BookingRule} table on
 * every import. Returns the persisted rules indexed by their GTFS
 * {@code booking_rule_id} so downstream importers (e.g. flex stop-times) can
 * resolve foreign-key references without an extra DB query.
 * The file is GTFS-flex optional; an absent file is silently skipped.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class BookingRuleImporter {

    private final BookingRuleRepository bookingRuleRepository;

    /**
     * Wipes the booking_rules table and re-imports from {@code booking_rules.txt}.
     * Returns persisted rules keyed by {@code booking_rule_id}; the map is empty
     * when the file is absent or contains no parseable rows.
     */
    public Map<String, BookingRule> importBookingRules(Path bookingRulesFile) throws IOException {
        bookingRuleRepository.deleteAllInBatch();
        bookingRuleRepository.flush();

        Map<String, BookingRule> result = new HashMap<>();
        if (!Files.exists(bookingRulesFile)) {
            log.info("GTFS import: booking_rules.txt missing, skipping");
            return result;
        }
        int skippedBadType = 0;
        try (CSVParser parser = openCsv(bookingRulesFile)) {
            for (CSVRecord record : parser) {
                String externalId = optional(record, "booking_rule_id");
                if (isBlank(externalId)) { continue; }
                Integer typeCode = parseIntOrNull(optional(record, "booking_type"));
                if (typeCode == null) {
                    skippedBadType++;
                    continue;
                }
                BookingType bookingType = BookingType.fromGtfsCode(typeCode);
                if (bookingType == null) {
                    skippedBadType++;
                    continue;
                }
                LocalTime cutoff = GtfsParse.parseGtfsTime(optional(record, "prior_notice_last_time"));

                String trimmed = externalId.trim();
                BookingRule rule = BookingRule.builder()
                        .externalId(truncate(trimmed, 100))
                        .bookingType(bookingType)
                        .priorNoticeDurationMin(parseIntOrNull(optional(record, "prior_notice_duration_min")))
                        .priorNoticeDurationMax(parseIntOrNull(optional(record, "prior_notice_duration_max")))
                        .priorNoticeLastDay(parseIntOrNull(optional(record, "prior_notice_last_day")))
                        .priorNoticeLastTime(cutoff)
                        .priorNoticeStartDay(parseIntOrNull(optional(record, "prior_notice_start_day")))
                        .phone(truncate(optional(record, "phone_number"), 30))
                        .bookingUrl(truncate(optional(record, "booking_url"), 500))
                        .infoUrl(truncate(optional(record, "info_url"), 500))
                        .message(truncate(optional(record, "message"), 1000))
                        .build();
                result.put(trimmed, rule);
            }
        }
        if (!result.isEmpty()) {
            bookingRuleRepository.saveAll(result.values());
        }
        if (skippedBadType > 0) {
            log.warn("GTFS import: skipped {} booking_rules rows with invalid booking_type",
                    skippedBadType);
        }
        log.info("GTFS import: {} booking rules persisted", result.size());
        return result;
    }
}
