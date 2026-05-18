package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.FeedInfo;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Admin-facing snapshot of the loaded GTFS feed metadata. All fields are
 * nullable because every {@code feed_info.txt} field is optional in GTFS,
 * and the file itself is optional. Frontends should treat absent values
 * as "unknown" rather than rendering empty strings.
 */
public record FeedInfoResponse(
        @Nullable String publisherName,
        @Nullable String publisherUrl,
        @Nullable String lang,
        @Nullable String defaultLang,
        @Nullable String feedVersion,
        @Nullable String contactEmail,
        @Nullable String contactUrl,
        @Nullable LocalDate startDate,
        @Nullable LocalDate endDate,
        @Nullable String sourceUrl,
        @Nullable String sourceHash,
        @Nullable Instant importedAt
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
