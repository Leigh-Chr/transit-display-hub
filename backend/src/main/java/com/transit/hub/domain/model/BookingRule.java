package com.transit.hub.domain.model;

import com.transit.hub.domain.model.enums.BookingType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
import org.jspecify.annotations.Nullable;

import java.time.LocalTime;
import java.util.UUID;

/**
 * Mirrors a row of GTFS {@code booking_rules.txt}. Tells passengers
 * how to book a demand-responsive trip — phone, URL, advance notice,
 * cutoff time. Referenced from {@code stop_times.pickup_booking_rule_id}
 * and {@code stop_times.drop_off_booking_rule_id} in fully-flexible
 * feeds; we don't wire those FKs onto {@link Schedule} until a
 * passenger surface justifies it (Phase 5.3 light scope).
 */
@Entity
@Table(name = "booking_rules",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_booking_rule_external_id",
           columnNames = {"external_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingRule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @NotBlank
    @Size(max = 100)
    @Column(name = "external_id", length = 100, nullable = false, unique = true)
    private String externalId;

    @Enumerated(EnumType.STRING)
    @Column(name = "booking_type", length = 20, nullable = false)
    private BookingType bookingType;

    /** Minimum notice period stored in <strong>seconds</strong>. The
     *  GTFS spec declares {@code prior_notice_duration_min} in minutes;
     *  {@code BookingRuleImporter} multiplies by 60 at the boundary so
     *  the stop-popup formatter (which renders "au moins 30 min" /
     *  "au moins 2 h" by dividing by 60 or 3600) gets a consistent
     *  unit. {@code SAME_DAY} bookings use this to express "at least
     *  30 min before departure". */
    @Column(name = "prior_notice_duration_min")
    private @Nullable Integer priorNoticeDurationMin;

    /** Maximum notice period in seconds — same minutes-from-spec ⇒
     *  seconds-in-storage convention as {@link #priorNoticeDurationMin}.
     *  Caps same-day windows ("can book up to 4 h before"). */
    @Column(name = "prior_notice_duration_max")
    private @Nullable Integer priorNoticeDurationMax;

    /** Last day before the trip when booking is allowed. Used by
     *  {@link BookingType#PRIOR_DAYS} bookings. */
    @Column(name = "prior_notice_last_day")
    private @Nullable Integer priorNoticeLastDay;

    /** Cutoff time on the prior-notice last day. */
    @Column(name = "prior_notice_last_time")
    private @Nullable LocalTime priorNoticeLastTime;

    /** First day prior to the trip when booking opens. */
    @Column(name = "prior_notice_start_day")
    private @Nullable Integer priorNoticeStartDay;

    /** Booking-line phone number. */
    @Size(max = 30)
    @Column(length = 30)
    private @Nullable String phone;

    /** Online booking URL. */
    @Size(max = 500)
    @Column(name = "booking_url", length = 500)
    private @Nullable String bookingUrl;

    /** Free-form info URL — schedule notes, accessibility info. */
    @Size(max = 500)
    @Column(name = "info_url", length = 500)
    private @Nullable String infoUrl;

    /** Free-form additional message shown alongside the booking
     *  details, e.g. "Service does not run on public holidays". */
    @Size(max = 1000)
    @Column(name = "message", length = 1000)
    private @Nullable String message;
}
