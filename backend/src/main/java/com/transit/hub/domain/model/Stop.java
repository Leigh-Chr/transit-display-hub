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
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
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
     *  stay valid until an admin reconciles them, but is excluded from
     *  every public-facing query. */
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

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "stop_lines",
            joinColumns = @JoinColumn(name = "stop_id"),
            inverseJoinColumns = @JoinColumn(name = "line_id"))
    @Builder.Default
    private Set<Line> lines = new HashSet<>();

    @OneToMany(mappedBy = "stop", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Schedule> schedules = new ArrayList<>();

    @OneToMany(mappedBy = "stop")
    @Builder.Default
    private List<Device> devices = new ArrayList<>();

    public void addLine(Line line) {
        lines.add(line);
        line.getStops().add(this);
    }

    public void removeLine(Line line) {
        lines.remove(line);
        line.getStops().remove(this);
    }
}
