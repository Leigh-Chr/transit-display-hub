package com.transit.hub.domain.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
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

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;

/**
 * Mirrors GTFS {@code calendar.txt}. A service calendar declares the
 * weekly pattern (which days of the week the service runs) over a
 * validity range {@code [startDate, endDate]}. One-off additions and
 * removals come in via {@link ServiceCalendarException}.
 * <p>
 * Persisted (rather than rebuilt at every import like the previous
 * in-memory record) so each {@link Schedule} can carry a
 * {@code service_calendar_id} foreign key, allowing the kiosk to filter
 * arrivals to the ones actually running today.
 */
@Entity
@Table(name = "service_calendars",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_service_calendar_external_id",
           columnNames = {"external_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ServiceCalendar {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** GTFS {@code service_id}. Stable across re-imports. */
    @NotBlank
    @Size(max = 100)
    @Column(name = "external_id", length = 100, nullable = false, unique = true)
    private String externalId;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(nullable = false)
    @Builder.Default
    private boolean monday = false;
    @Column(nullable = false)
    @Builder.Default
    private boolean tuesday = false;
    @Column(nullable = false)
    @Builder.Default
    private boolean wednesday = false;
    @Column(nullable = false)
    @Builder.Default
    private boolean thursday = false;
    @Column(nullable = false)
    @Builder.Default
    private boolean friday = false;
    @Column(nullable = false)
    @Builder.Default
    private boolean saturday = false;
    @Column(nullable = false)
    @Builder.Default
    private boolean sunday = false;

    @OneToMany(mappedBy = "serviceCalendar", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ServiceCalendarException> exceptions = new ArrayList<>();

    /** Returns the weekly pattern as an {@link EnumSet} for quick lookup. */
    public EnumSet<DayOfWeek> daysOfWeek() {
        EnumSet<DayOfWeek> set = EnumSet.noneOf(DayOfWeek.class);
        if (monday) {set.add(DayOfWeek.MONDAY);}
        if (tuesday) {set.add(DayOfWeek.TUESDAY);}
        if (wednesday) {set.add(DayOfWeek.WEDNESDAY);}
        if (thursday) {set.add(DayOfWeek.THURSDAY);}
        if (friday) {set.add(DayOfWeek.FRIDAY);}
        if (saturday) {set.add(DayOfWeek.SATURDAY);}
        if (sunday) {set.add(DayOfWeek.SUNDAY);}
        return set;
    }

    public void setDaysOfWeek(EnumSet<DayOfWeek> days) {
        this.monday = days.contains(DayOfWeek.MONDAY);
        this.tuesday = days.contains(DayOfWeek.TUESDAY);
        this.wednesday = days.contains(DayOfWeek.WEDNESDAY);
        this.thursday = days.contains(DayOfWeek.THURSDAY);
        this.friday = days.contains(DayOfWeek.FRIDAY);
        this.saturday = days.contains(DayOfWeek.SATURDAY);
        this.sunday = days.contains(DayOfWeek.SUNDAY);
    }
}
