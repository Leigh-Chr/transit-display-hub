package com.transit.hub.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.jspecify.annotations.Nullable;

import java.util.UUID;

/**
 * GTFS Fares v2 {@code fare_media.txt} — payment media (cash, transit
 * card, contactless EMV, mobile app, paper ticket). Referenced by
 * {@link FareProduct#getFareMediaId()} as a raw string; promoting that
 * column to a FK is deferred so v2 imports don't have to gate on media
 * being persisted first.
 */
@Entity
@Table(name = "fare_media",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_fare_media_external_id",
           columnNames = {"external_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FareMedia {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** GTFS {@code fare_media_id} — Required per spec. */
    @NotBlank
    @Size(max = 100)
    @Column(name = "external_id", nullable = false, length = 100)
    private String externalId;

    @Size(max = 200)
    @Column(name = "name", length = 200)
    private @Nullable String name;

    /** GTFS {@code fare_media_type}: 0=none, 1=paper, 2=transit_card,
     *  3=contactless_emv, 4=mobile_app. Required per spec, but kept
     *  nullable on purpose: stored as the raw int rather than an enum
     *  so values 5+ in future spec revisions don't choke the import,
     *  and a row with an unparseable media_type still lands so the
     *  admin can fix the feed rather than seeing the whole import
     *  drop silently. */
    @Column(name = "media_type")
    private @Nullable Short mediaType;
}
