package com.transit.hub.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Mirrors GTFS {@code feed_info.txt} as a singleton record describing the
 * provenance of the loaded feed: who published it, language, validity
 * window, and audit metadata about the last import. There is at most one
 * row per running instance — replaced (not appended to) on every successful
 * re-import.
 */
@Entity
@Table(name = "feed_info")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FeedInfo {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Version
    private Long version;

    @Size(max = 200)
    @Column(name = "publisher_name", length = 200)
    private String publisherName;

    @Size(max = 500)
    @Column(name = "publisher_url", length = 500)
    private String publisherUrl;

    @Size(max = 20)
    @Column(name = "lang", length = 20)
    private String lang;

    @Size(max = 20)
    @Column(name = "default_lang", length = 20)
    private String defaultLang;

    @Size(max = 50)
    @Column(name = "feed_version", length = 50)
    private String feedVersion;

    @Size(max = 50)
    @Column(name = "contact_email", length = 50)
    private String contactEmail;

    @Size(max = 500)
    @Column(name = "contact_url", length = 500)
    private String contactUrl;

    /** Inclusive lower bound of the validity window declared by the feed. */
    @Column(name = "start_date")
    private LocalDate startDate;

    /** Inclusive upper bound of the validity window declared by the feed. */
    @Column(name = "end_date")
    private LocalDate endDate;

    /** URL the feed was downloaded from on the last successful import. */
    @Size(max = 500)
    @Column(name = "source_url", length = 500)
    private String sourceUrl;

    /** SHA-256 of the source archive — used to detect unchanged re-downloads. */
    @Size(max = 64)
    @Column(name = "source_hash", length = 64)
    private String sourceHash;

    /** Wall-clock instant of the last successful import. */
    @Column(name = "imported_at")
    private Instant importedAt;
}
