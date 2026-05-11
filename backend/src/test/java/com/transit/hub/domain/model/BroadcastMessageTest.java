package com.transit.hub.domain.model;

import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.domain.model.enums.MessageSeverity;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("BroadcastMessage")
class BroadcastMessageTest {

    private static final Instant WINDOW_START = Instant.parse("2025-01-01T10:00:00Z");
    private static final Instant WINDOW_END   = Instant.parse("2025-01-01T18:00:00Z");

    private BroadcastMessage buildMessage(Instant start, Instant end) {
        return BroadcastMessage.builder()
                .title("Test Alert")
                .content("Test content")
                .severity(MessageSeverity.INFO)
                .startTime(start)
                .endTime(end)
                .scopeType(MessageScope.NETWORK)
                .build();
    }

    @Nested
    @DisplayName("isActive — wall-clock based")
    class IsActive {

        @Test
        @DisplayName("returns true when current time is between start and end")
        void withinRange_ReturnsTrue() {
            Instant now = Instant.now();
            BroadcastMessage message = buildMessage(
                    now.minus(1, ChronoUnit.HOURS),
                    now.plus(1, ChronoUnit.HOURS)
            );

            assertThat(message.isActive()).isTrue();
        }

        @Test
        @DisplayName("returns false when message is entirely in the future")
        void inFuture_ReturnsFalse() {
            Instant now = Instant.now();
            BroadcastMessage message = buildMessage(
                    now.plus(1, ChronoUnit.HOURS),
                    now.plus(2, ChronoUnit.HOURS)
            );

            assertThat(message.isActive()).isFalse();
        }

        @Test
        @DisplayName("returns false when message is entirely in the past")
        void inPast_ReturnsFalse() {
            Instant now = Instant.now();
            BroadcastMessage message = buildMessage(
                    now.minus(2, ChronoUnit.HOURS),
                    now.minus(1, ChronoUnit.HOURS)
            );

            assertThat(message.isActive()).isFalse();
        }

        @Test
        @DisplayName("returns false when start time is slightly in the future")
        void startTimeSlightlyInFuture_ReturnsFalse() {
            Instant now = Instant.now();
            BroadcastMessage message = buildMessage(
                    now.plus(10, ChronoUnit.SECONDS),
                    now.plus(1, ChronoUnit.HOURS)
            );

            assertThat(message.isActive()).isFalse();
        }

        @Test
        @DisplayName("returns false when end time is slightly in the past")
        void endTimeSlightlyInPast_ReturnsFalse() {
            Instant now = Instant.now();
            BroadcastMessage message = buildMessage(
                    now.minus(1, ChronoUnit.HOURS),
                    now.minus(10, ChronoUnit.SECONDS)
            );

            assertThat(message.isActive()).isFalse();
        }
    }

    @Nested
    @DisplayName("isActiveAt — deterministic boundary checks")
    class IsActiveAt {

        // Window: [10:00, 18:00)

        @ParameterizedTest(name = "[{index}] {0} → {2}")
        @CsvSource({
            "mid-window,           2025-01-01T14:00:00Z, true",
            "before-start,         2025-01-01T08:00:00Z, false",
            "after-end,            2025-01-01T20:00:00Z, false",
            "at-exact-start,       2025-01-01T10:00:00Z, true",
            "at-exact-end,         2025-01-01T18:00:00Z, false",
        })
        @DisplayName("returns the expected result for each timestamp against a fixed window")
        void boundaryCheck(String label, String queryIso, boolean expected) {
            Instant query = Instant.parse(queryIso);
            BroadcastMessage message = buildMessage(WINDOW_START, WINDOW_END);

            assertThat(message.isActiveAt(query)).isEqualTo(expected);
        }

        @Test
        @DisplayName("returns true one nanosecond after start")
        void oneNanoAfterStart_ReturnsTrue() {
            BroadcastMessage message = buildMessage(WINDOW_START, WINDOW_END);

            assertThat(message.isActiveAt(WINDOW_START.plusNanos(1))).isTrue();
        }

        @Test
        @DisplayName("returns true one nanosecond before end")
        void oneNanoBeforeEnd_ReturnsTrue() {
            BroadcastMessage message = buildMessage(WINDOW_START, WINDOW_END);

            assertThat(message.isActiveAt(WINDOW_END.minusNanos(1))).isTrue();
        }
    }

    @Nested
    @DisplayName("isValidTimeRange")
    class IsValidTimeRange {

        @ParameterizedTest(name = "[{index}] {0} → {3}")
        @CsvSource({
            "valid-range,        2025-01-01T10:00:00Z, 2025-01-01T18:00:00Z, true",
            "end-before-start,   2025-01-01T18:00:00Z, 2025-01-01T10:00:00Z, false",
            "equal-times,        2025-01-01T10:00:00Z, 2025-01-01T10:00:00Z, false",
        })
        @DisplayName("validates that start is strictly before end")
        void rangeCheck(String label, String startIso, String endIso, boolean expected) {
            BroadcastMessage message = buildMessage(
                    Instant.parse(startIso), Instant.parse(endIso));

            assertThat(message.isValidTimeRange()).isEqualTo(expected);
        }

        @Test
        @DisplayName("returns true when start time is null (defers to @NotNull)")
        void nullStartTime_ReturnsTrue() {
            BroadcastMessage message = BroadcastMessage.builder()
                    .title("Test")
                    .content("Content")
                    .severity(MessageSeverity.INFO)
                    .startTime(null)
                    .endTime(Instant.now())
                    .scopeType(MessageScope.NETWORK)
                    .build();

            assertThat(message.isValidTimeRange()).isTrue();
        }

        @Test
        @DisplayName("returns true when end time is null (defers to @NotNull)")
        void nullEndTime_ReturnsTrue() {
            BroadcastMessage message = BroadcastMessage.builder()
                    .title("Test")
                    .content("Content")
                    .severity(MessageSeverity.INFO)
                    .startTime(Instant.now())
                    .endTime(null)
                    .scopeType(MessageScope.NETWORK)
                    .build();

            assertThat(message.isValidTimeRange()).isTrue();
        }
    }
}
