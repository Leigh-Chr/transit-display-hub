package com.transit.hub.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.jspecify.annotations.Nullable;

import java.util.UUID;

/**
 * GTFS Fares v2 {@code fare_transfer_rules.txt} — the discount /
 * supplement that applies when a passenger transfers between two
 * leg groups. {@code fareTransferType}: 0 means "from + transfer
 * combined", 1 means "from then transfer", 2 means "transfer
 * replaces from". {@code durationLimit} expresses how long the
 * transfer remains valid in seconds.
 *
 * Group ids stay as plain strings rather than surrogate FKs because
 * a single {@code legGroupId} is shared across multiple
 * {@link FareLegRule} rows; the link is naturally many-to-many.
 */
@Entity
@Table(name = "fare_transfer_rules")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FareTransferRule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "from_leg_group_id", length = 100)
    private @Nullable String fromLegGroupId;

    @Column(name = "to_leg_group_id", length = 100)
    private @Nullable String toLegGroupId;

    @Column(name = "transfer_count")
    private @Nullable Integer transferCount;

    @Column(name = "duration_limit")
    private @Nullable Integer durationLimit;

    @Column(name = "duration_limit_type")
    private @Nullable Short durationLimitType;

    @Column(name = "fare_transfer_type", nullable = false)
    private Short fareTransferType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fare_product_id")
    private @Nullable FareProduct fareProduct;

    /** GTFS {@code minutes_before_to_start_boarding_time}: minimum
     *  minutes the next leg must start before the previous leg's
     *  boarding time for the transfer rule to apply. Null = no
     *  pre-boarding constraint. */
    @Column(name = "minutes_before_to_start_boarding_time")
    private @Nullable Integer minutesBeforeToStartBoardingTime;

    /** GTFS {@code minutes_after_to_start_boarding_time}: maximum
     *  minutes after the previous leg's boarding time within which the
     *  next leg must start. Null = no post-boarding constraint. */
    @Column(name = "minutes_after_to_start_boarding_time")
    private @Nullable Integer minutesAfterToStartBoardingTime;
}
