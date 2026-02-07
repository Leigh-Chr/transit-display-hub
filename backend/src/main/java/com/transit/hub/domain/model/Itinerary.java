package com.transit.hub.domain.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "itineraries",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_itinerary_line_name",
           columnNames = {"line_id", "name"}),
       indexes = {
           @Index(name = "idx_itinerary_line", columnList = "line_id")
       })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Itinerary {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @NotNull(message = "Line is required")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "line_id", nullable = false)
    private Line line;

    @NotBlank(message = "Name is required")
    @Size(max = 100, message = "Name must be at most 100 characters")
    @Column(nullable = false)
    private String name;

    @OneToMany(mappedBy = "itinerary", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    @Builder.Default
    private List<ItineraryStop> itineraryStops = new ArrayList<>();

    /**
     * Returns the terminus name derived from the last stop in the itinerary.
     * Returns null if the itinerary has no stops.
     */
    public String getTerminusName() {
        if (itineraryStops == null || itineraryStops.isEmpty()) {
            return null;
        }
        return itineraryStops.getLast().getStop().getName();
    }

    public void addStop(Stop stop, int position) {
        ItineraryStop itineraryStop = ItineraryStop.builder()
                .itinerary(this)
                .stop(stop)
                .position(position)
                .build();
        itineraryStops.add(itineraryStop);
    }

    public void removeStop(Stop stop) {
        itineraryStops.removeIf(is -> is.getStop().equals(stop));
        reorderStops();
    }

    public void clearStops() {
        itineraryStops.clear();
    }

    private void reorderStops() {
        for (int i = 0; i < itineraryStops.size(); i++) {
            itineraryStops.get(i).setPosition(i);
        }
    }
}
