package com.transit.hub.domain.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Mirrors a logical line in GTFS {@code shapes.txt}: a sequence of
 * {@link ShapePoint geographic points} that traces the path a vehicle
 * follows along the road / track. Linked from {@link Itinerary} so
 * a future map view can render each route as the actual polyline
 * rather than a stop-to-stop straight line.
 */
@Entity
@Table(name = "shapes",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_shape_external_id",
           columnNames = {"external_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Shape {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** GTFS {@code shape_id}. Stable across re-imports. */
    @NotBlank
    @Size(max = 100)
    @Column(name = "external_id", length = 100, nullable = false, unique = true)
    private String externalId;

    @OneToMany(mappedBy = "shape", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sequence ASC")
    @Builder.Default
    private List<ShapePoint> points = new ArrayList<>();
}
