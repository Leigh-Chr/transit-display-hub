package com.transit.hub.domain.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "stops")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Stop {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Version
    private Long version;

    /** GTFS {@code stop_id} from the source feed. Lets a re-import match
     *  this row to its replacement instead of recreating it (which would
     *  break devices and broadcast messages anchored to the old UUID).
     *  Null for stops created manually via the admin form. */
    @Size(max = 100)
    @Column(name = "external_id", length = 100)
    private String externalId;

    /** Soft-delete flag. A stop tombstoned by a re-import (its external_id
     *  vanished from the new feed) keeps its UUID so devices and messages
     *  stay valid until an admin reconciles them. Excluded from the
     *  kiosk-facing surfaces ({@code DisplayStateCalculator},
     *  {@code NetworkMapService}, hub display) via the {@code *Active*}
     *  repository variants; admin lookups still return the row with this
     *  flag set so the operator can decide between re-binding the devices
     *  or hard-deleting the stop. */
    @Column(nullable = false)
    @Builder.Default
    private boolean disabled = false;

    @NotBlank(message = "Name is required")
    @Size(max = 100, message = "Name must be at most 100 characters")
    @Column(nullable = false)
    private String name;

    @Column
    private Double latitude;

    @Column
    private Double longitude;

    @Column
    private Double schematicX;

    @Column
    private Double schematicY;

    /** GTFS {@code stop_code}: short identifier shown to passengers on
     *  the physical signpost (e.g. "BSP1234"). Useful to confirm "you
     *  are at the right stop" on the kiosk screen. */
    @Size(max = 50)
    @Column(name = "short_code", length = 50)
    private String shortCode;

    /** GTFS {@code tts_stop_name}: pronounceable form for screen readers
     *  and TTS-based accessibility tools. Falls back to {@link #name}. */
    @Size(max = 150)
    @Column(name = "tts_name", length = 150)
    private String ttsName;

    /** Per-stop IANA timezone, taking precedence over the agency's
     *  timezone for transit networks that cross zones (rare, but allowed
     *  by the GTFS spec). */
    @Size(max = 60)
    @Column(name = "stop_timezone", length = 60)
    private String stopTimezone;

    /** GTFS {@code stop_desc}. Free-form description shown in the network
     *  map's stop popup. */
    @Size(max = 500)
    @Column(length = 500)
    private String description;

    /** GTFS {@code stop_url}. Public-facing link, often the operator's
     *  page describing the stop. */
    @Size(max = 255)
    @Column(length = 255)
    private String url;

    /** GTFS {@code zone_id}. Opaque label that fare rules
     *  ({@code origin_id}, {@code destination_id}, {@code contains_id})
     *  reference to scope a price to a region of the network. Null on
     *  feeds that don't ship V1 fare data. */
    @Size(max = 100)
    @Column(name = "zone_id", length = 100)
    private String zoneId;

    /** GTFS {@code wheelchair_boarding} (0/1/2). Drives the PMR pictogram
     *  on the stop popup and shapes the route-finder when a passenger
     *  opts into the "accessible-only" filter. */
    @jakarta.persistence.Enumerated(jakarta.persistence.EnumType.STRING)
    @Column(name = "wheelchair_boarding", length = 20)
    private com.transit.hub.domain.model.enums.WheelchairAccess wheelchairBoarding;

    /** GTFS {@code platform_code}. Short identifier for the platform
     *  ("A", "12bis"). Each platform persists as its own Stop row with
     *  {@link #parentStop} pointing at its station — see Phase 1.3 in
     *  ADR 0022. Null on stops that don't represent a platform (parent
     *  stations themselves and free-standing bus poles). */
    @Size(max = 10)
    @Column(name = "platform_code", length = 10)
    private String platformCode;

    /** GTFS {@code stop_access}: 0 = generally accessible, 1 = staff
     *  / employees only. Spec forbids the field on station /
     *  entrance / node / boarding-area rows; we still let it through
     *  if the feed ships a value, since some operators use it to
     *  flag a closed-to-public station. */
    @Column(name = "stop_access")
    private Short stopAccess;

    /** GTFS {@code location_type}: 0 platform / regular stop (default),
     *  1 station / parent. Other values (entrance, generic node,
     *  boarding area) are skipped at import. The display calculator
     *  uses 1 to decide whether to aggregate children. */
    @Column(name = "location_type", nullable = false)
    @Builder.Default
    private short locationType = 0;

    /** Parent station for a platform. The display calculator follows
     *  this link in reverse — a kiosk bound to a station aggregates
     *  arrivals from every child platform — so existing devices
     *  bound to a previously-collapsed parent keep working. Null on
     *  free-standing stops without a parent. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_stop_id")
    private Stop parentStop;

    // Collections are exposed via explicit hand-written getters (below)
    // that return unmodifiable views, so callers must use the dedicated
    // mutators (addLine / removeLine / setLines, …). Hibernate still
    // reads the backing field via reflection — its persistent collection
    // wrapper stays untouched and the dirty-checking it relies on keeps
    // working transparently.
    @Getter(AccessLevel.NONE)
    @Setter(AccessLevel.NONE)
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "stop_lines",
            joinColumns = @JoinColumn(name = "stop_id"),
            inverseJoinColumns = @JoinColumn(name = "line_id"))
    @Builder.Default
    private Set<Line> lines = new HashSet<>();

    @Getter(AccessLevel.NONE)
    @Setter(AccessLevel.NONE)
    @OneToMany(mappedBy = "stop", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Schedule> schedules = new ArrayList<>();

    @Getter(AccessLevel.NONE)
    @Setter(AccessLevel.NONE)
    @OneToMany(mappedBy = "stop")
    @Builder.Default
    private List<Device> devices = new ArrayList<>();

    public Set<Line> getLines() {
        return Collections.unmodifiableSet(lines);
    }

    public List<Schedule> getSchedules() {
        return Collections.unmodifiableList(schedules);
    }

    public List<Device> getDevices() {
        return Collections.unmodifiableList(devices);
    }

    public void addLine(Line line) {
        lines.add(line);
        line.getStopsMutable().add(this);
    }

    public void removeLine(Line line) {
        lines.remove(line);
        line.getStopsMutable().remove(this);
    }

    public void clearLines() {
        // Detach this stop from both sides of the relation so the
        // owning-side @JoinTable rows are removed on flush.
        for (Line line : new HashSet<>(lines)) {
            line.getStopsMutable().remove(this);
        }
        lines.clear();
    }

    public void setLines(Collection<Line> replacement) {
        clearLines();
        for (Line line : replacement) {
            addLine(line);
        }
    }

    /**
     * Mutable accessor used by the cross-side bookkeeping in
     * {@link Line#addStop(Stop)} / {@link Line#removeStop(Stop)}. Marked
     * package-private to deter random callers; production code should
     * route through {@link #addLine(Line)} / {@link #removeLine(Line)}.
     */
    Set<Line> getLinesMutable() {
        return lines;
    }
}
