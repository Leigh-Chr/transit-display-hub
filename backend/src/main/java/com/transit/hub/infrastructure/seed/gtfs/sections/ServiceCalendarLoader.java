package com.transit.hub.infrastructure.seed.gtfs.sections;

import com.transit.hub.domain.model.ServiceCalendar;
import com.transit.hub.domain.model.ServiceCalendarException;
import com.transit.hub.domain.model.enums.ServiceExceptionType;
import com.transit.hub.infrastructure.persistence.ServiceCalendarRepository;
import com.transit.hub.infrastructure.seed.gtfs.GtfsParse;
import com.transit.hub.infrastructure.seed.gtfs.model.ServiceCalendarSnapshot;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseInt;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.truncate;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.openCsv;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.optional;

/**
 * Reads {@code calendar.txt} + {@code calendar_dates.txt} into snapshots,
 * persists them as {@link ServiceCalendar} rows (wiping any previous run
 * first) and logs the most representative reference date for the feed.
 * Extracted from {@code ScheduleImporter} so the schedule-row logic stays
 * focused on stop_times processing.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ServiceCalendarLoader {

    private final ServiceCalendarRepository serviceCalendarRepository;

    /**
     * Loads + persists service calendars for the feed in {@code workDir}.
     * Returns the {@code service_id → ServiceCalendar} map ready to attach
     * to schedules. Empty when neither {@code calendar.txt} nor
     * {@code calendar_dates.txt} declare any service.
     */
    public Map<String, ServiceCalendar> loadAndPersist(Path workDir) throws IOException {
        Map<String, ServiceCalendarSnapshot> snapshots = loadSnapshots(workDir);
        if (snapshots.isEmpty()) {
            return Map.of();
        }
        Map<String, ServiceCalendar> services = persist(snapshots);
        logReferenceDate(snapshots);
        return services;
    }

    private Map<String, ServiceCalendarSnapshot> loadSnapshots(Path workDir) throws IOException {
        Map<String, ServiceCalendarSnapshot.Builder> builders = new HashMap<>();

        Path calendar = workDir.resolve("calendar.txt");
        if (Files.exists(calendar)) {
            try (CSVParser parser = openCsv(calendar)) {
                for (CSVRecord record : parser) {
                    String serviceId = record.get("service_id");
                    Set<DayOfWeek> days = EnumSet.noneOf(DayOfWeek.class);
                    if ("1".equals(optional(record, "monday"))) { days.add(DayOfWeek.MONDAY); }
                    if ("1".equals(optional(record, "tuesday"))) { days.add(DayOfWeek.TUESDAY); }
                    if ("1".equals(optional(record, "wednesday"))) { days.add(DayOfWeek.WEDNESDAY); }
                    if ("1".equals(optional(record, "thursday"))) { days.add(DayOfWeek.THURSDAY); }
                    if ("1".equals(optional(record, "friday"))) { days.add(DayOfWeek.FRIDAY); }
                    if ("1".equals(optional(record, "saturday"))) { days.add(DayOfWeek.SATURDAY); }
                    if ("1".equals(optional(record, "sunday"))) { days.add(DayOfWeek.SUNDAY); }
                    LocalDate start = GtfsParse.parseGtfsDate(optional(record, "start_date"));
                    LocalDate end = GtfsParse.parseGtfsDate(optional(record, "end_date"));
                    builders.computeIfAbsent(serviceId, id -> new ServiceCalendarSnapshot.Builder())
                            .withWeekly(start, end, days);
                }
            }
        }

        Path calendarDates = workDir.resolve("calendar_dates.txt");
        if (Files.exists(calendarDates)) {
            try (CSVParser parser = openCsv(calendarDates)) {
                for (CSVRecord record : parser) {
                    String serviceId = record.get("service_id");
                    LocalDate date = GtfsParse.parseGtfsDate(record.get("date"));
                    if (date == null) { continue; }
                    int exceptionType = parseInt(record.get("exception_type"), 0);
                    ServiceCalendarSnapshot.Builder b =
                            builders.computeIfAbsent(serviceId, id -> new ServiceCalendarSnapshot.Builder());
                    if (exceptionType == 1) { b.added(date); }
                    else if (exceptionType == 2) { b.removed(date); }
                }
            }
        }

        Map<String, ServiceCalendarSnapshot> result = new HashMap<>();
        for (Map.Entry<String, ServiceCalendarSnapshot.Builder> e : builders.entrySet()) {
            result.put(e.getKey(), e.getValue().build());
        }
        return result;
    }

    private Map<String, ServiceCalendar> persist(Map<String, ServiceCalendarSnapshot> snapshots) {
        serviceCalendarRepository.deleteAllInBatch();
        serviceCalendarRepository.flush();

        Map<String, ServiceCalendar> result = new HashMap<>();
        for (Map.Entry<String, ServiceCalendarSnapshot> e : snapshots.entrySet()) {
            String externalId = e.getKey();
            ServiceCalendarSnapshot snap = e.getValue();
            ServiceCalendar entity = ServiceCalendar.builder()
                    .externalId(truncate(externalId, 100))
                    .startDate(snap.startDate())
                    .endDate(snap.endDate())
                    .build();
            entity.setDaysOfWeek(snap.daysOfWeek());
            for (LocalDate d : snap.addedDates()) {
                entity.getExceptions().add(ServiceCalendarException.builder()
                        .serviceCalendar(entity)
                        .date(d)
                        .exceptionType(ServiceExceptionType.ADDED)
                        .build());
            }
            for (LocalDate d : snap.removedDates()) {
                entity.getExceptions().add(ServiceCalendarException.builder()
                        .serviceCalendar(entity)
                        .date(d)
                        .exceptionType(ServiceExceptionType.REMOVED)
                        .build());
            }
            ServiceCalendar saved = serviceCalendarRepository.save(entity);
            result.put(externalId, saved);
        }
        log.info("GTFS import: {} service calendars persisted (with {} exceptions)",
                result.size(),
                result.values().stream().mapToInt(c -> c.getExceptions().size()).sum());
        return result;
    }

    private void logReferenceDate(Map<String, ServiceCalendarSnapshot> snapshots) {
        Set<String> active = pickActiveServices(snapshots);
        if (active.isEmpty()) {
            log.info("GTFS import: no service is active anywhere in the next 30 days; feed may be stale");
        }
    }

    /**
     * Pick the set of service IDs running on the most representative day available.
     * Prefers today, falls back to scanning ±30 days, then to the busiest day in the
     * combined feed range. Returns empty when no services are defined at all.
     */
    private Set<String> pickActiveServices(Map<String, ServiceCalendarSnapshot> services) {
        if (services.isEmpty()) { return Set.of(); }

        LocalDate today = LocalDate.now();
        for (int offset = 0; offset <= 30; offset++) {
            for (int sign : new int[]{1, -1}) {
                if (offset == 0 && sign == -1) { continue; }
                LocalDate candidate = today.plusDays(offset * (long) sign);
                Set<String> active = activeOn(services, candidate);
                if (!active.isEmpty()) {
                    log.info("GTFS import: schedule reference date is {} ({} active services)",
                            candidate, active.size());
                    return active;
                }
            }
        }

        LocalDate scanStart = services.values().stream()
                .map(ServiceCalendarSnapshot::startDate)
                .filter(d -> d != null)
                .min(LocalDate::compareTo)
                .orElse(today);
        LocalDate scanEnd = services.values().stream()
                .map(ServiceCalendarSnapshot::endDate)
                .filter(d -> d != null)
                .max(LocalDate::compareTo)
                .orElse(today);

        Set<String> best = Set.of();
        LocalDate bestDate = null;
        for (LocalDate d = scanStart;
                !d.isAfter(scanEnd) && d.isBefore(scanStart.plusDays(365));
                d = d.plusDays(1)) {
            Set<String> active = activeOn(services, d);
            if (active.size() > best.size()) {
                best = active;
                bestDate = d;
            }
        }
        if (!best.isEmpty()) {
            log.info("GTFS import: schedule reference date is {} ({} active services, fallback scan)",
                    bestDate, best.size());
        }
        return best;
    }

    private Set<String> activeOn(Map<String, ServiceCalendarSnapshot> services, LocalDate date) {
        Set<String> active = new HashSet<>();
        for (Map.Entry<String, ServiceCalendarSnapshot> e : services.entrySet()) {
            if (e.getValue().isActiveOn(date)) { active.add(e.getKey()); }
        }
        return active;
    }
}
