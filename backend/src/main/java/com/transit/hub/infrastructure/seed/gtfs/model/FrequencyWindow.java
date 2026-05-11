package com.transit.hub.infrastructure.seed.gtfs.model;

import java.time.LocalTime;

/**
 * A single frequency window from {@code frequencies.txt}, opening from
 * {@code start} (inclusive) to {@code end} (exclusive) with a recurring
 * trip every {@code headwaySeconds}. {@code exactTimes} follows the GTFS
 * convention: 1 = schedule-based replication, 0/null = headway-based.
 * Times are GTFS wall-clock so a window crossing midnight (start &gt; end
 * after mod-24 folding) is normalised by the schedule fan-out iterator.
 */
public record FrequencyWindow(LocalTime start, LocalTime end,
                              int headwaySeconds, Boolean exactTimes) {}
