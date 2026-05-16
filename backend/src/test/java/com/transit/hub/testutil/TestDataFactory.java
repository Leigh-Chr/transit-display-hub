package com.transit.hub.testutil;

import com.transit.hub.domain.model.*;
import com.transit.hub.domain.model.enums.*;

import java.time.Instant;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Factory class for creating test data consistently across tests.
 */
public final class TestDataFactory {

    private TestDataFactory() {
        // Utility class
    }

    // ============== LINE ==============

    public static Line createLine(String code, String name, String color) {
        return Line.builder()
                .id(UUID.randomUUID())
                .code(code)
                .name(name)
                .color(color)
                .build();
    }

    public static Line createLine() {
        return createLine("L1", "Metro Line 1", "#FF5733");
    }

    public static Line createLineWithId(UUID id, String code, String name, String color) {
        return Line.builder()
                .id(id)
                .code(code)
                .name(name)
                .color(color)
                .build();
    }

    // ============== STOP ==============

    public static Stop createStop(String name, Line... lines) {
        Set<Line> lineSet = new HashSet<>(Arrays.asList(lines));
        Stop stop = Stop.builder()
                .id(UUID.randomUUID())
                .name(name)
                .lines(lineSet)
                .build();
        for (Line line : lines) {
            if (line != null) {
                stop.addLine(line);
            }
        }
        return stop;
    }

    public static Stop createStop(Line line) {
        return createStop("Central Station", line);
    }

    public static Stop createStopWithId(UUID id, String name, Line... lines) {
        Set<Line> lineSet = new HashSet<>(Arrays.asList(lines));
        return Stop.builder()
                .id(id)
                .name(name)
                .lines(lineSet)
                .build();
    }

    // ============== ITINERARY ==============

    public static Itinerary createItinerary(Line line, String name) {
        Itinerary itinerary = Itinerary.builder()
                .id(UUID.randomUUID())
                .line(line)
                .name(name)
                .build();
        return itinerary;
    }

    public static Itinerary createItineraryWithId(UUID id, Line line, String name) {
        Itinerary itinerary = Itinerary.builder()
                .id(id)
                .line(line)
                .name(name)
                .build();
        return itinerary;
    }

    public static Itinerary createItineraryWithStops(Line line, String name, Stop... stops) {
        Itinerary itinerary = Itinerary.builder()
                .id(UUID.randomUUID())
                .line(line)
                .name(name)
                .build();
        for (int i = 0; i < stops.length; i++) {
            itinerary.addStop(stops[i], i);
        }
        return itinerary;
    }

    // ============== SCHEDULE ==============

    public static Schedule createSchedule(LocalTime time, Stop stop, Itinerary itinerary) {
        return Schedule.builder()
                .id(UUID.randomUUID())
                .time(time)
                .stop(stop)
                .itinerary(itinerary)
                .build();
    }

    public static Schedule createSchedule(Stop stop, Itinerary itinerary) {
        return createSchedule(LocalTime.of(8, 30), stop, itinerary);
    }

    public static Schedule createScheduleWithId(UUID id, LocalTime time, Stop stop, Itinerary itinerary) {
        return Schedule.builder()
                .id(id)
                .time(time)
                .stop(stop)
                .itinerary(itinerary)
                .build();
    }

    // ============== BROADCAST MESSAGE ==============

    public static BroadcastMessage createMessage(MessageScope scope, UUID scopeId) {
        Instant now = Instant.now();
        return BroadcastMessage.builder()
                .id(UUID.randomUUID())
                .title("Test Alert")
                .content("This is a test alert message")
                .severity(MessageSeverity.INFO)
                .startTime(now.minus(1, ChronoUnit.HOURS))
                .endTime(now.plus(1, ChronoUnit.HOURS))
                .scopeType(scope)
                .scopeId(scopeId)
                .build();
    }

    public static BroadcastMessage createNetworkMessage() {
        return createMessage(MessageScope.NETWORK, null);
    }

    public static BroadcastMessage createLineMessage(UUID lineId) {
        return createMessage(MessageScope.LINE, lineId);
    }

    public static BroadcastMessage createStopMessage(UUID stopId) {
        return createMessage(MessageScope.STOP, stopId);
    }

    public static BroadcastMessage createMessageWithTimes(
            MessageScope scope,
            UUID scopeId,
            Instant startTime,
            Instant endTime
    ) {
        return BroadcastMessage.builder()
                .id(UUID.randomUUID())
                .title("Scheduled Alert")
                .content("This is a scheduled alert message")
                .severity(MessageSeverity.WARNING)
                .startTime(startTime)
                .endTime(endTime)
                .scopeType(scope)
                .scopeId(scopeId)
                .build();
    }

    public static BroadcastMessage createCriticalMessage(MessageScope scope, UUID scopeId) {
        Instant now = Instant.now();
        return BroadcastMessage.builder()
                .id(UUID.randomUUID())
                .title("Critical Alert")
                .content("This is a critical alert message")
                .severity(MessageSeverity.CRITICAL)
                .startTime(now.minus(1, ChronoUnit.HOURS))
                .endTime(now.plus(1, ChronoUnit.HOURS))
                .scopeType(scope)
                .scopeId(scopeId)
                .build();
    }

    // ============== DEVICE ==============

    private static final String DEFAULT_TOKEN_LOOKUP = "testlook";

    public static Device createDevice(Stop stop) {
        return Device.builder()
                .id(UUID.randomUUID())
                .tokenLookup(DEFAULT_TOKEN_LOOKUP)
                .tokenHash("hashed_token_value")
                .stop(stop)
                .status(DeviceStatus.OFFLINE)
                .lastHeartbeat(null)
                .build();
    }

    public static Device createOnlineDevice(Stop stop) {
        return Device.builder()
                .id(UUID.randomUUID())
                .tokenLookup(DEFAULT_TOKEN_LOOKUP)
                .tokenHash("hashed_token_value")
                .stop(stop)
                .status(DeviceStatus.ONLINE)
                .lastHeartbeat(Instant.now())
                .build();
    }

    public static Device createDeviceWithId(UUID id, String tokenHash, Stop stop, DeviceStatus status) {
        return Device.builder()
                .id(id)
                .tokenLookup(DEFAULT_TOKEN_LOOKUP)
                .tokenHash(tokenHash)
                .stop(stop)
                .status(status)
                .lastHeartbeat(status == DeviceStatus.ONLINE ? Instant.now() : null)
                .build();
    }

    public static Device createDeviceWithLookup(Stop stop, String tokenLookup, String tokenHash) {
        return Device.builder()
                .id(UUID.randomUUID())
                .tokenLookup(tokenLookup)
                .tokenHash(tokenHash)
                .stop(stop)
                .status(DeviceStatus.OFFLINE)
                .lastHeartbeat(null)
                .build();
    }

    // ============== USER ==============

    public static User createUser(String username, UserRole role) {
        return User.builder()
                .id(UUID.randomUUID())
                .username(username)
                .password("encoded_password")
                .role(role)
                .enabled(true)
                .build();
    }

    public static User createAdmin(String username) {
        return createUser(username, UserRole.ADMIN);
    }

    public static User createAgent(String username) {
        return createUser(username, UserRole.AGENT);
    }

    public static User createDisabledUser(String username, UserRole role) {
        return User.builder()
                .id(UUID.randomUUID())
                .username(username)
                .password("encoded_password")
                .role(role)
                .enabled(false)
                .build();
    }

    public static User createUserWithPassword(String username, String encodedPassword, UserRole role) {
        return User.builder()
                .id(UUID.randomUUID())
                .username(username)
                .password(encodedPassword)
                .role(role)
                .enabled(true)
                .build();
    }
}
