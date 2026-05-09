package com.transit.hub.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
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
 * GTFS Fares v2 {@code rider_categories.txt}. A rider category groups
 * passengers eligible for the same fare product (adult, child, senior,
 * disability …). Linked from {@link FareProduct#getRiderCategoryId()}
 * by external_id.
 */
@Entity
@Table(name = "rider_categories",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_rider_category_external_id",
           columnNames = {"external_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RiderCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @NotBlank
    @Size(max = 100)
    @Column(name = "external_id", nullable = false, length = 100)
    private String externalId;

    @Size(max = 200)
    @Column(length = 200)
    private String name;

    /** GTFS {@code is_default_fare_category}: 0 = not the default,
     *  1 = the default category for the rider's fare media when no
     *  other category matches. */
    @Column(name = "is_default_fare_category")
    private Short isDefaultFareCategory;

    @Size(max = 500)
    @Column(name = "eligibility_url", length = 500)
    private String eligibilityUrl;
}
