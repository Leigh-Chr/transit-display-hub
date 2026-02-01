package com.transit.hub.domain.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "lines")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Line {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @NotBlank(message = "Code is required")
    @Size(max = 10, message = "Code must be at most 10 characters")
    @Column(unique = true, nullable = false)
    private String code;

    @NotBlank(message = "Name is required")
    @Size(max = 100, message = "Name must be at most 100 characters")
    @Column(nullable = false)
    private String name;

    @NotBlank(message = "Color is required")
    @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "Color must be a valid hex color (e.g., #FF5733)")
    @Column(nullable = false)
    private String color;

    @OneToMany(mappedBy = "line", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Stop> stops = new ArrayList<>();

    public void addStop(Stop stop) {
        stops.add(stop);
        stop.setLine(this);
    }

    public void removeStop(Stop stop) {
        stops.remove(stop);
        stop.setLine(null);
    }
}
