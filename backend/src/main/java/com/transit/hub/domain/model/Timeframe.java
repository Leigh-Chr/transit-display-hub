package com.transit.hub.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.jspecify.annotations.Nullable;

import java.time.LocalTime;
import java.util.UUID;

/**
 * GTFS Fares v2 {@code timeframes.txt} — a window of time during a
 * service day, used by {@link FareLegRule} to pick fare products
 * by time of day. Multiple rows can share a {@code timeframeGroupId}
 * (one per (service, window) tuple).
 */
@Entity
@Table(name = "timeframes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Timeframe {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "timeframe_group_id", nullable = false, length = 100)
    private String timeframeGroupId;

    @Column(name = "start_time")
    private @Nullable LocalTime startTime;

    @Column(name = "end_time")
    private @Nullable LocalTime endTime;

    @Column(name = "service_id", length = 100)
    private @Nullable String serviceId;
}
