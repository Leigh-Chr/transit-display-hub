package com.transit.hub.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
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
 * Mirrors GTFS {@code attributions.txt}. A row credits an organisation
 * for producing, operating or having authority over the feed (or a
 * specific agency / route / trip within it). Used to build the footer
 * credit block on both the public network map and the admin dashboard,
 * replacing the single env-var attribution we used to surface.
 * <p>
 * GTFS allows multiple roles per row via three independent flags
 * ({@code is_producer}, {@code is_operator}, {@code is_authority}); we
 * keep the same shape so a single organisation that produces and
 * operates a network gets one row, not three.
 */
@Entity
@Table(name = "attributions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Attribution {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** GTFS {@code attribution_id} when the feed publishes one. Null is
     *  fine; the spec doesn't require it. */
    @Size(max = 100)
    @Column(name = "external_id", length = 100)
    private @Nullable String externalId;

    @NotBlank
    @Size(max = 200)
    @Column(name = "organization_name", nullable = false, length = 200)
    private String organizationName;

    @Column(name = "is_producer", nullable = false)
    @Builder.Default
    private boolean producer = false;

    @Column(name = "is_operator", nullable = false)
    @Builder.Default
    private boolean operator = false;

    @Column(name = "is_authority", nullable = false)
    @Builder.Default
    private boolean authority = false;

    /** GTFS {@code agency_id} the row applies to (null = whole feed). */
    @Size(max = 100)
    @Column(name = "agency_external_id", length = 100)
    private @Nullable String agencyExternalId;

    /** GTFS {@code route_id} the row applies to (null = whole feed). */
    @Size(max = 100)
    @Column(name = "route_external_id", length = 100)
    private @Nullable String routeExternalId;

    /** GTFS {@code trip_id} the row applies to (null = whole feed). */
    @Size(max = 100)
    @Column(name = "trip_external_id", length = 100)
    private @Nullable String tripExternalId;

    @Size(max = 500)
    @Column(length = 500)
    private @Nullable String url;

    @Size(max = 100)
    @Column(length = 100)
    private @Nullable String email;

    @Size(max = 30)
    @Column(length = 30)
    private @Nullable String phone;
}
