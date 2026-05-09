package com.transit.hub.domain.model;

import com.transit.hub.domain.model.enums.LineType;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "lines")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Line {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Version
    private Long version;

    /** GTFS {@code route_id}. Persisted so a re-import can match rows
     *  rather than recreate them (which would break the broadcast
     *  messages and itineraries anchored to the old UUID). */
    @Size(max = 100)
    @Column(name = "external_id", length = 100)
    private String externalId;

    @NotBlank(message = "Code is required")
    @Size(max = 30, message = "Code must be at most 30 characters")
    @Column(unique = true, nullable = false, length = 30)
    private String code;

    @NotBlank(message = "Name is required")
    @Size(max = 100, message = "Name must be at most 100 characters")
    @Column(nullable = false)
    private String name;

    @NotBlank(message = "Color is required")
    @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "Color must be a valid hex color (e.g., #FF5733)")
    @Column(nullable = false)
    private String color;

    /**
     * Foreground color used to render text on top of {@link #color}. When the
     * GTFS feed provides {@code route_text_color} we keep it verbatim;
     * otherwise the importer derives a contrast-safe value from {@link #color}
     * via the YIQ luminance formula. Stored so frontends don't have to
     * recompute it for every render.
     */
    @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "Text color must be a valid hex color (e.g., #FFFFFF)")
    @Column(name = "text_color", length = 7)
    private String textColor;

    @Enumerated(EnumType.STRING)
    @Column(length = 15)
    private LineType type;

    @Size(max = 50, message = "Category must be at most 50 characters")
    @Column(length = 50)
    private String category;

    /** GTFS {@code continuous_pickup} (route-level). 0 = continuous (any
     *  point), 1 = no continuous service (default), 2 = phone agency,
     *  3 = coordinate with driver. Non-default values flag hop-on/hop-off
     *  routes the stop popup can surface. */
    @Column(name = "continuous_pickup", nullable = false)
    @Builder.Default
    private short continuousPickup = 1;

    /** GTFS {@code continuous_drop_off}. Same encoding as
     *  {@link #continuousPickup}. */
    @Column(name = "continuous_drop_off", nullable = false)
    @Builder.Default
    private short continuousDropOff = 1;

    /** GTFS {@code route_sort_order}. Drives the stable line ordering on
     *  the network map and admin lists. Lines without a value sort after
     *  those with one, then by code. */
    @Column(name = "sort_order")
    private Integer sortOrder;

    /** GTFS {@code route_desc}. Free-form description shown in the stop
     *  popup and admin detail view. */
    @Size(max = 500)
    @Column(length = 500)
    private String description;

    /** GTFS {@code route_url}. Public link to the operator's page about
     *  this line. */
    @Size(max = 255)
    @Column(length = 255)
    private String url;

    /** GTFS {@code routes.cemv_support}: line-level contactless EMV
     *  acceptance — 0 not supported, 1 supported, 2 ask the operator.
     *  Takes precedence over the agency value. */
    @Column(name = "cemv_support")
    private Short cemvSupport;

    /** Operating agency. Nullable because lines created via the legacy
     *  admin form (or imported from feeds without {@code agency.txt})
     *  may not have one. The {@code DisplayStateCalculator} falls back
     *  to {@code app.timezone} when this is null. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agency_id")
    private Agency agency;

    @ManyToMany(mappedBy = "lines")
    @Builder.Default
    private Set<Stop> stops = new HashSet<>();

    @OneToMany(mappedBy = "line", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private Set<Itinerary> itineraries = new HashSet<>();
}
