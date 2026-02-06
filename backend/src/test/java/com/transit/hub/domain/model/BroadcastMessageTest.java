package com.transit.hub.domain.model;

import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.domain.model.enums.MessageSeverity;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("BroadcastMessage")
class BroadcastMessageTest {

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
    @DisplayName("isActive")
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
            // Start 10 seconds from now -- current time is before start
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
            // End 10 seconds ago -- current time is after end
            BroadcastMessage message = buildMessage(
                    now.minus(1, ChronoUnit.HOURS),
                    now.minus(10, ChronoUnit.SECONDS)
            );

            assertThat(message.isActive()).isFalse();
        }
    }

    @Nested
    @DisplayName("isActiveAt")
    class IsActiveAt {

        @Test
        @DisplayName("returns true when queried time is between start and end")
        void withinRange_ReturnsTrue() {
            Instant start = Instant.parse("2025-01-01T10:00:00Z");
            Instant end = Instant.parse("2025-01-01T18:00:00Z");
            Instant queryTime = Instant.parse("2025-01-01T14:00:00Z");
            BroadcastMessage message = buildMessage(start, end);

            assertThat(message.isActiveAt(queryTime)).isTrue();
        }

        @Test
        @DisplayName("returns false when queried time is before start")
        void beforeStart_ReturnsFalse() {
            Instant start = Instant.parse("2025-01-01T10:00:00Z");
            Instant end = Instant.parse("2025-01-01T18:00:00Z");
            Instant queryTime = Instant.parse("2025-01-01T08:00:00Z");
            BroadcastMessage message = buildMessage(start, end);

            assertThat(message.isActiveAt(queryTime)).isFalse();
        }

        @Test
        @DisplayName("returns false when queried time is after end")
        void afterEnd_ReturnsFalse() {
            Instant start = Instant.parse("2025-01-01T10:00:00Z");
            Instant end = Instant.parse("2025-01-01T18:00:00Z");
            Instant queryTime = Instant.parse("2025-01-01T20:00:00Z");
            BroadcastMessage message = buildMessage(start, end);

            assertThat(message.isActiveAt(queryTime)).isFalse();
        }

        @Test
        @DisplayName("returns false when queried time equals start time (exclusive)")
        void atExactStart_ReturnsFalse() {
            Instant start = Instant.parse("2025-01-01T10:00:00Z");
            Instant end = Instant.parse("2025-01-01T18:00:00Z");
            BroadcastMessage message = buildMessage(start, end);

            assertThat(message.isActiveAt(start)).isFalse();
        }

        @Test
        @DisplayName("returns false when queried time equals end time (exclusive)")
        void atExactEnd_ReturnsFalse() {
            Instant start = Instant.parse("2025-01-01T10:00:00Z");
            Instant end = Instant.parse("2025-01-01T18:00:00Z");
            BroadcastMessage message = buildMessage(start, end);

            assertThat(message.isActiveAt(end)).isFalse();
        }

        @Test
        @DisplayName("returns true one nanosecond after start")
        void oneNanoAfterStart_ReturnsTrue() {
            Instant start = Instant.parse("2025-01-01T10:00:00Z");
            Instant end = Instant.parse("2025-01-01T18:00:00Z");
            BroadcastMessage message = buildMessage(start, end);

            assertThat(message.isActiveAt(start.plusNanos(1))).isTrue();
        }

        @Test
        @DisplayName("returns true one nanosecond before end")
        void oneNanoBeforeEnd_ReturnsTrue() {
            Instant start = Instant.parse("2025-01-01T10:00:00Z");
            Instant end = Instant.parse("2025-01-01T18:00:00Z");
            BroadcastMessage message = buildMessage(start, end);

            assertThat(message.isActiveAt(end.minusNanos(1))).isTrue();
        }
    }

    @Nested
    @DisplayName("isValidTimeRange")
    class IsValidTimeRange {

        @Test
        @DisplayName("returns true when end is after start")
        void validRange_ReturnsTrue() {
            Instant start = Instant.parse("2025-01-01T10:00:00Z");
            Instant end = Instant.parse("2025-01-01T18:00:00Z");
            BroadcastMessage message = buildMessage(start, end);

            assertThat(message.isValidTimeRange()).isTrue();
        }

        @Test
        @DisplayName("returns false when end is before start")
        void endBeforeStart_ReturnsFalse() {
            Instant start = Instant.parse("2025-01-01T18:00:00Z");
            Instant end = Instant.parse("2025-01-01T10:00:00Z");
            BroadcastMessage message = buildMessage(start, end);

            assertThat(message.isValidTimeRange()).isFalse();
        }

        @Test
        @DisplayName("returns false when start equals end")
        void equalTimes_ReturnsFalse() {
            Instant time = Instant.parse("2025-01-01T10:00:00Z");
            BroadcastMessage message = buildMessage(time, time);

            assertThat(message.isValidTimeRange()).isFalse();
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
