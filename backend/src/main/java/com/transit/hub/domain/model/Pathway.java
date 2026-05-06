package com.transit.hub.domain.model;

import com.transit.hub.domain.model.enums.PathwayMode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/**
 * Mirrors a row of GTFS {@code pathways.txt}. A {@code Pathway}
 * connects two stops within a station — typically a platform to a
 * concourse, or two platforms across a hallway — and exposes the
 * physical mode (stairs, elevator, escalator) plus a traversal time.
 * <p>
 * Endpoints can be platforms, generic nodes ({@code location_type=3})
 * or boarding areas ({@code location_type=4}). Until Phase 1.3 lands
 * the per-platform display, the importer collapses everything to root
 * stops, so most pathways will reference the parent station on both
 * ends; that's still useful as topology metadata for the admin.
 */
@Entity
@Table(name = "pathways",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_pathway_external_id",
           columnNames = {"external_id"}),
       indexes = {
           @Index(name = "idx_pathway_from", columnList = "from_stop_id"),
           @Index(name = "idx_pathway_to", columnList = "to_stop_id")
       })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Pathway {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** GTFS {@code pathway_id}. Stable across re-imports. */
    @NotBlank
    @Size(max = 100)
    @Column(name = "external_id", length = 100, nullable = false, unique = true)
    private String externalId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "from_stop_id", nullable = false)
    private Stop fromStop;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "to_stop_id", nullable = false)
    private Stop toStop;

    @Enumerated(EnumType.STRING)
    @Column(name = "pathway_mode", length = 20, nullable = false)
    private PathwayMode pathwayMode;

    /** GTFS {@code is_bidirectional}: false (default) means the pathway
     *  only goes from→to; true allows reverse traversal. */
    @Column(name = "is_bidirectional", nullable = false)
    @Builder.Default
    private boolean bidirectional = false;

    /** Optional length in metres. */
    @Column(name = "length_metres")
    private Double lengthMetres;

    /** Optional traversal time in seconds. The kiosk can show
     *  "≈ 90 s" when routing through a hub; null when not provided. */
    @Column(name = "traversal_time_seconds")
    private Integer traversalTimeSeconds;

    /** Optional stair count for {@link PathwayMode#STAIRS} pathways. */
    @Column(name = "stair_count")
    private Integer stairCount;

    /** Optional maximum slope along the pathway. */
    @Column(name = "max_slope")
    private Double maxSlope;

    /** Minimum width in metres. Useful for accessibility filtering. */
    @Column(name = "min_width_metres")
    private Double minWidthMetres;

    /** GTFS {@code signposted_as}: text shown on the physical signpost
     *  when entering the pathway from {@code fromStop}. */
    @Size(max = 200)
    @Column(name = "signposted_as", length = 200)
    private String signpostedAs;

    /** GTFS {@code reversed_signposted_as}: same as {@link #signpostedAs}
     *  but for the reverse direction (only meaningful when
     *  {@link #bidirectional} is true). */
    @Size(max = 200)
    @Column(name = "reversed_signposted_as", length = 200)
    private String reversedSignpostedAs;
}
