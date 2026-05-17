package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.NetworkMapResponse.AlertMessage;
import com.transit.hub.application.dto.response.NetworkMapResponse.AlertsResponse;
import com.transit.hub.domain.model.BroadcastMessage;
import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.domain.model.enums.MessageSeverity;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import com.transit.hub.testutil.TestDataFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("NetworkAlertsService")
class NetworkAlertsServiceTest {

    @Mock
    private BroadcastMessageRepository broadcastMessageRepository;

    @Spy
    private Clock clock = Clock.systemDefaultZone();

    @InjectMocks
    private NetworkAlertsService networkAlertsService;

    @Test
    @DisplayName("returns empty response when no active messages")
    void returnsEmptyWhenNoActiveMessages() {
        when(broadcastMessageRepository.findActiveMessages(any(Instant.class))).thenReturn(List.of());

        AlertsResponse result = networkAlertsService.getAlerts();

        assertThat(result.networkAlerts()).isEmpty();
        assertThat(result.lineAlerts()).isEmpty();
        assertThat(result.stopAlerts()).isEmpty();
    }

    @Test
    @DisplayName("categorizes alerts by scope")
    void categorizesByScope() {
        UUID lineId = UUID.randomUUID();
        UUID stopId = UUID.randomUUID();
        BroadcastMessage networkMsg = TestDataFactory.createNetworkMessage();
        BroadcastMessage lineMsg = TestDataFactory.createLineMessage(lineId);
        BroadcastMessage stopMsg = TestDataFactory.createStopMessage(stopId);

        when(broadcastMessageRepository.findActiveMessages(any(Instant.class)))
                .thenReturn(List.of(networkMsg, lineMsg, stopMsg));

        AlertsResponse result = networkAlertsService.getAlerts();

        assertThat(result.networkAlerts()).hasSize(1);
        assertThat(result.lineAlerts()).containsKey(lineId);
        assertThat(result.lineAlerts().get(lineId)).hasSize(1);
        assertThat(result.stopAlerts()).containsKey(stopId);
        assertThat(result.stopAlerts().get(stopId)).hasSize(1);
    }

    @Test
    @DisplayName("groups multiple alerts for same scope")
    void groupsMultipleAlertsForSameScope() {
        UUID lineId = UUID.randomUUID();
        BroadcastMessage msg1 = TestDataFactory.createLineMessage(lineId);
        BroadcastMessage msg2 = TestDataFactory.createCriticalMessage(MessageScope.LINE, lineId);

        when(broadcastMessageRepository.findActiveMessages(any(Instant.class)))
                .thenReturn(List.of(msg1, msg2));

        AlertsResponse result = networkAlertsService.getAlerts();

        assertThat(result.lineAlerts().get(lineId)).hasSize(2);
        assertThat(result.lineAlerts().get(lineId))
                .extracting(AlertMessage::severity)
                .contains(MessageSeverity.INFO, MessageSeverity.CRITICAL);
    }

    @Test
    @DisplayName("returns alerts of all three scopes in correct collections")
    void returnsAlertsOfAllScopesCorrectly() {
        UUID lineId = UUID.randomUUID();
        UUID stopId = UUID.randomUUID();
        BroadcastMessage networkMsg = TestDataFactory.createNetworkMessage();
        networkMsg.setTitle("Network Issue");
        BroadcastMessage lineMsg = TestDataFactory.createLineMessage(lineId);
        lineMsg.setTitle("Line Delay");
        BroadcastMessage stopMsg = TestDataFactory.createStopMessage(stopId);
        stopMsg.setTitle("Stop Closed");
        BroadcastMessage criticalNetwork = TestDataFactory.createCriticalMessage(MessageScope.NETWORK, null);
        criticalNetwork.setTitle("Critical Network");

        when(broadcastMessageRepository.findActiveMessages(any(Instant.class)))
                .thenReturn(List.of(networkMsg, lineMsg, stopMsg, criticalNetwork));

        AlertsResponse result = networkAlertsService.getAlerts();

        assertThat(result.networkAlerts()).hasSize(2);
        assertThat(result.networkAlerts()).extracting(AlertMessage::title)
                .containsExactlyInAnyOrder("Network Issue", "Critical Network");
        assertThat(result.lineAlerts()).containsKey(lineId);
        assertThat(result.lineAlerts().get(lineId)).hasSize(1);
        assertThat(result.stopAlerts()).containsKey(stopId);
        assertThat(result.stopAlerts().get(stopId)).hasSize(1);
    }
}
