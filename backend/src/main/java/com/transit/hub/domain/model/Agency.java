package com.transit.hub.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.jspecify.annotations.Nullable;

import java.util.UUID;

/**
 * Mirrors GTFS {@code agency.txt}. A network may publish multiple agencies
 * sharing the same feed (e.g. operator + concessionnaire), so the entity
 * is plural even when most installs see a single row.
 * <p>
 * The {@code externalId} column stores the GTFS {@code agency_id} when
 * provided; it lets re-imports match agencies across feed refreshes
 * without renaming or duplicating the row.
 */
@Entity
@Table(name = "agencies",
       indexes = @Index(name = "idx_agency_external_id", columnList = "external_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Agency {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Version
    private @Nullable Long version;

    /** GTFS {@code agency_id}. Null only when the feed declares a single
     *  unnamed agency (which the spec allows). */
    @Size(max = 100)
    @Column(name = "external_id", length = 100)
    private @Nullable String externalId;

    @NotBlank
    @Size(max = 200)
    @Column(nullable = false, length = 200)
    private String name;

    @Size(max = 500)
    @Column(length = 500)
    private @Nullable String url;

    /**
     * IANA timezone identifier as published by the agency (e.g.
     * {@code "Europe/Paris"}). The {@code DisplayStateCalculator} resolves
     * the operating zone via the line's agency before falling back to the
     * application-level default.
     */
    @Size(max = 60)
    @Column(length = 60)
    private @Nullable String timezone;

    /** BCP-47 language tag — same width as {@link FeedInfo#getLang()}
     *  and {@link Translation#getLanguage()} (20). 10 was too tight for
     *  the longer extended tags ({@code "zh-Hans-CN"} = 10, no margin). */
    @Size(max = 20)
    @Column(length = 20)
    private @Nullable String lang;

    @Size(max = 30)
    @Column(length = 30)
    private @Nullable String phone;

    @Size(max = 500)
    @Column(name = "fare_url", length = 500)
    private @Nullable String fareUrl;

    @Size(max = 100)
    @Column(length = 100)
    private @Nullable String email;

    /** GTFS {@code agency.cemv_support}: contactless EMV (card-tap)
     *  acceptance — 0 not supported, 1 supported, 2 ask the operator.
     *  May be overridden per line via {@link Line#getCemvSupport()}. */
    @Column(name = "cemv_support")
    private @Nullable Short cemvSupport;
}
