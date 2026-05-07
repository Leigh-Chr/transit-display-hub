package com.transit.hub.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

import java.util.UUID;

/**
 * One row of GTFS {@code shapes.txt}. The {@code (shape, sequence)} pair
 * is unique by spec; we enforce it at the schema level so mis-ordered
 * imports surface as constraint violations rather than silently
 * misshaping the polyline.
 */
@Entity
@Table(name = "shape_points",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_shape_point_sequence",
           columnNames = {"shape_id", "sequence"}),
       indexes = {
           @Index(name = "idx_shape_point_shape", columnList = "shape_id")
       })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShapePoint {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "shape_id", nullable = false)
    private Shape shape;

    /** GTFS {@code shape_pt_sequence}. Sparse-allowed integer that
     *  defines the relative ordering of points along the shape. */
    @Column(nullable = false)
    private int sequence;

    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    /** GTFS {@code shape_dist_traveled} — distance along the shape from
     *  the first point. Optional (the spec's recommended unit is
     *  metres but feeds vary). */
    @Column(name = "dist_traveled")
    private Double distTraveled;
}
