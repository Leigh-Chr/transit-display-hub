package com.transit.hub.infrastructure.seed.gtfs.sections;

import com.transit.hub.domain.model.BookingRule;
import com.transit.hub.domain.model.enums.BookingType;
import com.transit.hub.infrastructure.persistence.BookingRuleRepository;
import com.transit.hub.infrastructure.seed.gtfs.GtfsParse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Path;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.isBlank;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseIntOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.truncate;
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
        Map<String, BookingRule> result = new HashMap<>();
        GtfsSectionImporter.runWithStats(
                bookingRuleRepository,
                bookingRulesFile,
                "booking rules",
                (record, skip) -> mapRow(record, result, skip),
                log
        );
        return result;
    }

    private static Optional<BookingRule> mapRow(
            CSVRecord record,
            Map<String, BookingRule> resultIndex,
            GtfsSectionImporter.SkipTracker skip
    ) {
        String externalId = optional(record, "booking_rule_id");
        if (isBlank(externalId)) {
            return Optional.empty();
        }
        Integer typeCode = parseIntOrNull(optional(record, "booking_type"));
        if (typeCode == null) {
            skip.skip("invalid booking_type");
            return Optional.empty();
        }
        BookingType bookingType = BookingType.fromGtfsCode(typeCode);
        if (bookingType == null) {
            skip.skip("invalid booking_type");
            return Optional.empty();
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
        resultIndex.put(trimmed, rule);
        return Optional.of(rule);
    }
}
