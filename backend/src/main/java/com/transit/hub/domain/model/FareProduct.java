package com.transit.hub.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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

import java.math.BigDecimal;
import java.util.UUID;

/**
 * GTFS Fares v2 {@code fare_products.txt} — a payable product (pass,
 * single ticket, day pass) with a price. The {@code fareMediaId} is
 * stored as a raw string because {@code fare_media.txt} is out of
 * scope — when we import it later, the link becomes a proper FK.
 */
@Entity
@Table(name = "fare_products",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_fare_product_external_id",
           columnNames = {"external_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FareProduct {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** GTFS {@code fare_product_id} — Required per spec. */
    @NotBlank
    @Size(max = 100)
    @Column(name = "external_id", nullable = false, length = 100)
    private String externalId;

    @Size(max = 200)
    @Column(name = "name", length = 200)
    private @Nullable String name;

    @Size(max = 100)
    @Column(name = "fare_media_id", length = 100)
    private @Nullable String fareMediaId;

    /** GTFS {@code rider_category_id} — the rider category this product
     *  is priced for. Stored as the raw external_id; resolve against the
     *  {@code rider_categories} table when a typed reference is needed. */
    @Size(max = 100)
    @Column(name = "rider_category_id", length = 100)
    private @Nullable String riderCategoryId;

    /** GTFS {@code amount} — Required per spec. May be zero (free
     *  product); the spec allows negative values to model transfer
     *  discounts, so no {@code @PositiveOrZero} constraint here.
     *  Contrast with the legacy {@link FareAttribute#price} which the
     *  spec restricts to non-negative. */
    @NotNull
    @Column(name = "amount", nullable = false, precision = 12, scale = 4)
    private BigDecimal amount;

    /** GTFS {@code currency} — ISO 4217 code, exactly 3 chars, Required. */
    @NotBlank
    @Size(min = 3, max = 3)
    @Column(name = "currency", nullable = false, length = 3)
    private String currency;
}
