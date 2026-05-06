package com.transit.hub.domain.model;

import com.transit.hub.domain.model.enums.LineType;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.HashSet;
import java.util.Set;
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

    @Version
    private Long version;

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

    /**
     * Foreground color used to render text on top of {@link #color}. When the
     * GTFS feed provides {@code route_text_color} we keep it verbatim;
     * otherwise the importer derives a contrast-safe value from {@link #color}
     * via the YIQ luminance formula. Stored so frontends don't have to
     * recompute it for every render.
     */
    @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "Text color must be a valid hex color (e.g., #FFFFFF)")
    @Column(name = "text_color", length = 7)
    private String textColor;

    @Enumerated(EnumType.STRING)
    @Column(length = 15)
    private LineType type;

    @Size(max = 50, message = "Category must be at most 50 characters")
    @Column(length = 50)
    private String category;

    /** Operating agency. Nullable because lines created via the legacy
     *  admin form (or imported from feeds without {@code agency.txt})
     *  may not have one. The {@code DisplayStateCalculator} falls back
     *  to {@code app.timezone} when this is null. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agency_id")
    private Agency agency;

    @ManyToMany(mappedBy = "lines")
    @Builder.Default
    private Set<Stop> stops = new HashSet<>();

    @OneToMany(mappedBy = "line", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private Set<Itinerary> itineraries = new HashSet<>();
}
