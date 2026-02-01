package com.transit.hub.domain.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.ArrayList;
import java.util.List;
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

    @NotBlank(message = "Name is required")
    @Size(max = 100, message = "Name must be at most 100 characters")
    @Column(nullable = false)
    private String name;

    @NotNull(message = "Line is required")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "line_id", nullable = false)
    private Line line;

    @OneToMany(mappedBy = "stop", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<TimedEntry> timedEntries = new ArrayList<>();

    @OneToMany(mappedBy = "stop")
    @Builder.Default
    private List<Device> devices = new ArrayList<>();

    public void addTimedEntry(TimedEntry entry) {
        timedEntries.add(entry);
        entry.setStop(this);
    }

    public void removeTimedEntry(TimedEntry entry) {
        timedEntries.remove(entry);
        entry.setStop(null);
    }
}
