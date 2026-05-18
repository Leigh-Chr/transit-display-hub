package com.transit.hub.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
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

    /** GTFS {@code timeframe_group_id} — Required per spec. */
    @NotBlank
    @Size(max = 100)
    @Column(name = "timeframe_group_id", nullable = false, length = 100)
    private String timeframeGroupId;

    /** GTFS {@code start_time}. Null = bound implicit at 00:00:00 — the
     *  spec uses an absent value rather than literal "00:00:00", and
     *  {@code LocalTime} can't represent the 24:00:00 upper bound that
     *  {@link #endTime} would need (max = 23:59:59.999999999). The fare
     *  evaluator treats {@code null} as "from start of service day". */
    @Column(name = "start_time")
    private @Nullable LocalTime startTime;

    /** GTFS {@code end_time}. Null = bound implicit at 24:00:00 — same
     *  convention as {@link #startTime}, the evaluator treats {@code null}
     *  as "until end of service day". */
    @Column(name = "end_time")
    private @Nullable LocalTime endTime;

    @Column(name = "service_id", length = 100)
    private @Nullable String serviceId;
}
