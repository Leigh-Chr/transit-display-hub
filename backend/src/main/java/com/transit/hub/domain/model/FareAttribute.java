package com.transit.hub.domain.model;

import com.transit.hub.domain.model.enums.FarePaymentMethod;
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
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.jspecify.annotations.Nullable;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Mirrors a row of GTFS {@code fare_attributes.txt} (Fares v1). Carries
 * the price, currency and transfer policy of a fare; the conditions
 * under which the fare applies — which routes, which origin / destination
 * zones — live on the linked {@link FareRule} rows.
 * <p>
 * Stored as-is rather than collapsed into the trip / route model so
 * the admin can audit each fare individually. Fares v2 (fare_products,
 * fare_leg_rules) is intentionally out of scope for this phase; the
 * schema can be extended without disturbing v1 data.
 */
@Entity
@Table(name = "fare_attributes",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_fare_attribute_external_id",
           columnNames = {"external_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FareAttribute {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** GTFS {@code fare_id}. */
    @NotBlank
    @Size(max = 100)
    @Column(name = "external_id", length = 100, nullable = false, unique = true)
    private String externalId;

    /** Price stored as {@code BigDecimal} so the kiosk can render
     *  "1,80 €" exactly without float rounding. */
    @Column(precision = 12, scale = 4, nullable = false)
    private BigDecimal price;

    /** ISO-4217 three-letter code (EUR, USD, GBP, …). */
    @NotBlank
    @Size(max = 3)
    @Column(length = 3, nullable = false)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", length = 20, nullable = false)
    private FarePaymentMethod paymentMethod;

    /** GTFS {@code transfers} — number of transfers allowed on the
     *  same fare. {@code null} means unlimited (the spec encodes that
     *  by leaving the cell empty); 0/1/2 mean no, one or two. */
    @Column
    private @Nullable Integer transfers;

    /** GTFS {@code transfer_duration} — seconds during which the fare
     *  is valid. Null when unbounded. */
    @Column(name = "transfer_duration")
    private @Nullable Integer transferDuration;

    /** Optional agency the fare belongs to. Required by the spec when
     *  the feed declares more than one agency. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agency_id")
    private @Nullable Agency agency;

    @OneToMany(mappedBy = "fareAttribute", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<FareRule> rules = new ArrayList<>();
}
