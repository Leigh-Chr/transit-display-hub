package com.transit.hub.application.dto.response;

import java.util.List;

/**
 * Single-call payload backing /admin/dashboard. Exposes counters for the
 * sidebar and just enough detail (top 6 lines, recent + active messages,
 * offline devices preview) to render the dashboard cards without forcing
 * the front-end to issue five non-paginated GETs in parallel.
 */
public record DashboardResponse(
        long lineCount,
        long stopCount,
        long itineraryCount,
        List<LineResponse> topLines,
        List<MessageResponse> activeMessages,
        List<MessageResponse> recentMessages,
        DeviceSummary devices
) {
    public record DeviceSummary(
            long total,
            long online,
            long offline,
            List<DeviceResponse> offlinePreview
    ) {}
}
