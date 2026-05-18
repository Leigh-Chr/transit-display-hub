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

    @Column(name = "external_id", nullable = false, length = 100)
    private String externalId;

    @Column(name = "name", length = 200)
    private @Nullable String name;

    @Column(name = "fare_media_id", length = 100)
    private @Nullable String fareMediaId;

    /** GTFS {@code rider_category_id} — the rider category this product
     *  is priced for. Stored as the raw external_id; resolve against the
     *  {@code rider_categories} table when a typed reference is needed. */
    @Column(name = "rider_category_id", length = 100)
    private @Nullable String riderCategoryId;

    @Column(name = "amount", nullable = false, precision = 12, scale = 4)
    private BigDecimal amount;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency;
}
