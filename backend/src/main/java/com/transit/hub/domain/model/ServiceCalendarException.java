package com.transit.hub.domain.model;

import com.transit.hub.domain.model.enums.ServiceExceptionType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Mirrors a single row of GTFS {@code calendar_dates.txt}. Either adds
 * or removes a date from its parent {@link ServiceCalendar}'s weekly
 * pattern. The (calendar, date) pair is unique by GTFS rule.
 * <p>
 * The {@code Exception} suffix is the GTFS domain term (a service-pattern
 * exception like "closed on Christmas"), <em>not</em> a Java
 * {@link Throwable}. SpotBugs reports {@code NM_CLASS_NOT_EXCEPTION} on
 * this name; the rule is suppressed via the project filter because
 * renaming would break the published SQL table {@code service_calendar_exceptions}
 * and downstream Flyway migrations.
 */
@Entity
@Table(name = "service_calendar_exceptions",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_service_calendar_exception",
           columnNames = {"service_calendar_id", "date"}),
       indexes = {
           @Index(name = "idx_service_calendar_exception_calendar",
                  columnList = "service_calendar_id"),
           @Index(name = "idx_service_calendar_exception_date", columnList = "date")
       })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ServiceCalendarException {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "service_calendar_id", nullable = false)
    private ServiceCalendar serviceCalendar;

    @Column(nullable = false)
    private LocalDate date;

    @Enumerated(EnumType.STRING)
    @Column(name = "exception_type", length = 16, nullable = false)
    private ServiceExceptionType exceptionType;
}
