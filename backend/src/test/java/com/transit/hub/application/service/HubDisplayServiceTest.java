package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.DisplayState;
import com.transit.hub.application.dto.response.HubDisplayState;
import com.transit.hub.application.dto.response.LineInfo;
import com.transit.hub.domain.model.enums.BikesAllowed;
import com.transit.hub.domain.model.enums.MessageSeverity;
import com.transit.hub.domain.model.enums.PickupKind;
import com.transit.hub.domain.model.enums.WheelchairAccess;
import com.transit.hub.infrastructure.persistence.StopRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HubDisplayServiceTest {

    @Mock private DisplayStateCalculator displayStateCalculator;
    @Mock private StopRepository stopRepository;

    private HubDisplayService service;

    private final Clock clock = Clock.fixed(Instant.parse("2026-05-16T10:00:00Z"), ZoneId.of("UTC"));

    @BeforeEach
    void setUp() {
        service = new HubDisplayService(displayStateCalculator, stopRepository, clock);
    }

    @Test
    void unknownStopIdsAreFilteredOut() {
        UUID known = UUID.randomUUID();
        UUID unknown = UUID.randomUUID();
        when(stopRepository.findExistingIdsIn(anyList())).thenReturn(List.of(known));
        when(displayStateCalculator.calculateForStop(known)).thenReturn(emptyDisplayState("Central"));

        HubDisplayState result = service.getHubDisplayState(List.of(known, unknown), "central-hub");

        assertThat(result.hubName()).isEqualTo("central-hub");
        verify(displayStateCalculator, times(1)).calculateForStop(known);
        verify(displayStateCalculator, times(0)).calculateForStop(unknown);
    }

    @Test
    void versionCounterIncrementsPerHub() {
        UUID stop = UUID.randomUUID();
        when(stopRepository.findExistingIdsIn(anyList())).thenReturn(List.of(stop));
        when(displayStateCalculator.calculateForStop(stop)).thenReturn(emptyDisplayState("S1"));

        HubDisplayState first = service.getHubDisplayState(List.of(stop), "hub-a");
        HubDisplayState second = service.getHubDisplayState(List.of(stop), "hub-a");
        HubDisplayState other = service.getHubDisplayState(List.of(stop), "hub-b");

        assertThat(first.version()).isEqualTo(1L);
        assertThat(second.version()).isEqualTo(2L);
        // The second hub keeps its own monotonic counter — that's the
        // explicit fix for the cross-hub version race documented in the
        // service's javadoc, so the regression test belongs here.
        assertThat(other.version()).isEqualTo(1L);
    }

    @Test
    void arrivalsAreMergedSortedAndCappedAtFifty() {
        UUID stop = UUID.randomUUID();
        when(stopRepository.findExistingIdsIn(anyList())).thenReturn(List.of(stop));

        // Produce 60 arrivals, intentionally unsorted so we exercise the
        // sort + cap rather than the trivial pass-through.
        List<DisplayState.ArrivalInfo> arrivals = new java.util.ArrayList<>();
        for (int i = 60; i >= 1; i--) {
            arrivals.add(new DisplayState.ArrivalInfo(
                    LocalTime.of(8, 0).plusMinutes(i),
                    "Dest-" + i,
                    new LineInfo(UUID.randomUUID(), "L" + i, "Line " + i, "#fff", "#000"),
                    PickupKind.NORMAL,
                    WheelchairAccess.UNKNOWN,
                    BikesAllowed.UNKNOWN,
                    true,
                    null,
                    null,
                    null,
                    null
            ));
        }
        when(displayStateCalculator.calculateForStop(stop))
                .thenReturn(displayStateWithArrivals("S1", arrivals));

        HubDisplayState result = service.getHubDisplayState(List.of(stop), "hub-cap");

        assertThat(result.arrivals()).hasSize(50);
        // First arrival = 08:01 (earliest after sort)
        assertThat(result.arrivals().get(0).scheduledTime()).isEqualTo(LocalTime.of(8, 1));
        assertThat(result.arrivals().get(49).scheduledTime()).isEqualTo(LocalTime.of(8, 50));
    }

    @Test
    void messagesAreDeduplicatedAcrossStops() {
        UUID s1 = UUID.randomUUID();
        UUID s2 = UUID.randomUUID();
        when(stopRepository.findExistingIdsIn(anyList())).thenReturn(List.of(s1, s2));
        DisplayState.MessageInfo shared = new DisplayState.MessageInfo("Shared", "Body", MessageSeverity.INFO);
        DisplayState.MessageInfo onlyS2 = new DisplayState.MessageInfo("Only S2", "Body", MessageSeverity.WARNING);

        lenient().when(displayStateCalculator.calculateForStop(s1))
                .thenReturn(displayStateWithMessages("S1", List.of(shared)));
        lenient().when(displayStateCalculator.calculateForStop(s2))
                .thenReturn(displayStateWithMessages("S2", List.of(shared, onlyS2)));

        HubDisplayState result = service.getHubDisplayState(List.of(s1, s2), "hub-msgs");

        assertThat(result.messages()).hasSize(2);
        assertThat(result.messages()).contains(shared, onlyS2);
    }

    private DisplayState emptyDisplayState(String stopName) {
        return new DisplayState(
                UUID.randomUUID(), stopName, null, null,
                List.of(), List.of(), List.of(), 0L, Instant.now(clock));
    }

    private DisplayState displayStateWithArrivals(String stopName, List<DisplayState.ArrivalInfo> arrivals) {
        return new DisplayState(
                UUID.randomUUID(), stopName, null, null,
                List.of(), arrivals, List.of(), 0L, Instant.now(clock));
    }

    private DisplayState displayStateWithMessages(String stopName, List<DisplayState.MessageInfo> messages) {
        return new DisplayState(
                UUID.randomUUID(), stopName, null, null,
                List.of(), List.of(), messages, 0L, Instant.now(clock));
    }
}
