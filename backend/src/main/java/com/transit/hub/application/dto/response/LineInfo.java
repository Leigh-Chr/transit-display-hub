package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Line;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

public record LineInfo(UUID id, String code, String name, String color, String textColor) {
    public static LineInfo from(Line line) {
        return new LineInfo(line.getId(), line.getCode(), line.getName(), line.getColor(), line.getTextColor());
    }

    /**
     * Maps a collection of {@link Line} to {@link LineInfo} sorted by
     * {@code code}, which is the natural order the kiosk and admin
     * surfaces both consume. Centralising this avoids the
     * {@code sorted(Comparator.comparing(Line::getCode)).map(LineInfo::from)}
     * incantation duplicated across four call sites.
     */
    public static List<LineInfo> fromSorted(Collection<Line> lines) {
        return lines.stream()
                .sorted(Comparator.comparing(Line::getCode))
                .map(LineInfo::from)
                .toList();
    }
}
