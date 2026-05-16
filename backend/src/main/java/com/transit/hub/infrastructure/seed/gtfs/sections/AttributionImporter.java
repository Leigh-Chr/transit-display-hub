package com.transit.hub.infrastructure.seed.gtfs.sections;

import com.transit.hub.domain.model.Attribution;
import com.transit.hub.infrastructure.persistence.AttributionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Optional;

import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.isBlank;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.truncate;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.optional;

/**
 * Reads {@code attributions.txt} and replaces the {@link Attribution} table on
 * every import so credits never linger after the operator drops a line. The
 * file is GTFS-optional; absent file is silently skipped.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AttributionImporter {

    private final AttributionRepository attributionRepository;

    /**
     * Wipes the attributions table and re-imports from {@code attributions.txt}.
     * Absent file is silently skipped.
     */
    public void importAttributions(Path attributionsFile) throws IOException {
        GtfsSectionImporter.run(
                attributionRepository,
                attributionsFile,
                "attributions",
                AttributionImporter::mapRow,
                log
        );
    }

    private static Optional<Attribution> mapRow(CSVRecord record) {
        String name = optional(record, "organization_name");
        if (isBlank(name)) {
            return Optional.empty();
        }
        return Optional.of(Attribution.builder()
                .externalId(truncate(optional(record, "attribution_id"), 100))
                .organizationName(truncate(name, 200))
                .producer("1".equals(optional(record, "is_producer")))
                .operator("1".equals(optional(record, "is_operator")))
                .authority("1".equals(optional(record, "is_authority")))
                .agencyExternalId(truncate(optional(record, "agency_id"), 100))
                .routeExternalId(truncate(optional(record, "route_id"), 100))
                .tripExternalId(truncate(optional(record, "trip_id"), 100))
                .url(truncate(optional(record, "attribution_url"), 500))
                .email(truncate(optional(record, "attribution_email"), 100))
                .phone(truncate(optional(record, "attribution_phone"), 30))
                .build());
    }
}
