package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.FeedInfo;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Admin-facing snapshot of the loaded GTFS feed metadata. All fields are
 * nullable because every {@code feed_info.txt} field is optional in GTFS,
 * and the file itself is optional. Frontends should treat absent values
 * as "unknown" rather than rendering empty strings.
 */
public record FeedInfoResponse(
        String publisherName,
        String publisherUrl,
        String lang,
        String defaultLang,
        String feedVersion,
        String contactEmail,
        String contactUrl,
        LocalDate startDate,
        LocalDate endDate,
        String sourceUrl,
        String sourceHash,
        Instant importedAt
) {
    public static FeedInfoResponse from(FeedInfo info) {
        return new FeedInfoResponse(
                info.getPublisherName(),
                info.getPublisherUrl(),
                info.getLang(),
                info.getDefaultLang(),
                info.getFeedVersion(),
                info.getContactEmail(),
                info.getContactUrl(),
                info.getStartDate(),
                info.getEndDate(),
                info.getSourceUrl(),
                info.getSourceHash(),
                info.getImportedAt()
        );
    }
}
