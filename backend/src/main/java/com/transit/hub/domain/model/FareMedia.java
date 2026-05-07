package com.transit.hub.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

    @Column(name = "external_id", nullable = false, length = 100)
    private String externalId;

    @Column(name = "name", length = 200)
    private String name;

    /** GTFS {@code fare_media_type}: 0=none, 1=paper, 2=transit_card,
     *  3=contactless_emv, 4=mobile_app. Stored as the raw int because
     *  values 5+ may appear in future spec revisions and we don't want
     *  the import to choke on unknown enum values. */
    @Column(name = "media_type")
    private Short mediaType;
}
