package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.NetworkMapResponse;
import com.transit.hub.application.dto.response.NetworkMapResponse.AlertsResponse;
import com.transit.hub.application.dto.response.NetworkMapResponse.Bounds;
import com.transit.hub.domain.event.MessageChangedEvent;
import com.transit.hub.domain.event.NetworkChangedEvent;
import com.transit.hub.infrastructure.websocket.ActiveDisplayTracker;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Covers the write-side spun out of NetworkMapService in v1.18.0:
 * cache eviction on domain events and the WebSocket push fan-out.
 * Read-side behaviour (getNetworkMap / getAlerts) stays in
 * NetworkMapServiceTest.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("NetworkMapPublisher")
class NetworkMapPublisherTest {

    @Mock
    private NetworkMapService networkMapService;

    @Mock
    private CacheManager cacheManager;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private ActiveDisplayTracker activeDisplayTracker;

    @InjectMocks
    private NetworkMapPublisher publisher;

    private static NetworkMapResponse emptyMap() {
        return new NetworkMapResponse(
                List.of(), List.of(), List.of(), new Bounds(0, 0, 1, 1), null);
    }

    private static AlertsResponse emptyAlerts() {
        return new AlertsResponse(List.of(), Map.of(), Map.of());
    }

    @Test
    @DisplayName("evicts caches and pushes FULL_UPDATE WebSocket payload on NetworkChangedEvent")
    void evictsCachesAndPushesOnNetworkChangedEvent() {
        Cache networkMapCache = mock(Cache.class);
        Cache networkAlertsCache = mock(Cache.class);
        when(cacheManager.getCache("networkMap")).thenReturn(networkMapCache);
        when(cacheManager.getCache("networkAlerts")).thenReturn(networkAlertsCache);
        when(networkMapService.getNetworkMap()).thenReturn(emptyMap());
        when(networkMapService.getAlerts()).thenReturn(emptyAlerts());
        when(activeDisplayTracker.hasNetworkMapSubscribers()).thenReturn(true);

        publisher.onNetworkChanged(new NetworkChangedEvent(this, Set.of()));

        verify(networkMapCache).clear();
        verify(networkAlertsCache).clear();
        ArgumentCaptor<Object> payloadCaptor = ArgumentCaptor.forClass(Object.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/network-map"), payloadCaptor.capture());
        @SuppressWarnings("unchecked")
        Map<String, Object> payload = (Map<String, Object>) payloadCaptor.getValue();
        assertThat(payload).containsEntry("type", "FULL_UPDATE");
        assertThat(payload).containsKeys("networkMap", "alerts");
    }

    @Test
    @DisplayName("skips push when no map subscribers")
    void skipsPushWhenNoSubscribers() {
        Cache networkMapCache = mock(Cache.class);
        Cache networkAlertsCache = mock(Cache.class);
        when(cacheManager.getCache("networkMap")).thenReturn(networkMapCache);
        when(cacheManager.getCache("networkAlerts")).thenReturn(networkAlertsCache);
        when(activeDisplayTracker.hasNetworkMapSubscribers()).thenReturn(false);

        publisher.onNetworkChanged(new NetworkChangedEvent(this, Set.of()));

        verify(networkMapCache).clear();
        verify(networkAlertsCache).clear();
        verify(messagingTemplate, never()).convertAndSend(eq("/topic/network-map"), any(Object.class));
    }

    @Test
    @DisplayName("evicts alerts cache and pushes ALERTS_UPDATE WebSocket payload on MessageChangedEvent")
    void evictsAlertsCacheAndPushesOnMessageChangedEvent() {
        Cache networkAlertsCache = mock(Cache.class);
        when(cacheManager.getCache("networkAlerts")).thenReturn(networkAlertsCache);
        when(networkMapService.getAlerts()).thenReturn(emptyAlerts());
        when(activeDisplayTracker.hasNetworkMapSubscribers()).thenReturn(true);

        publisher.onMessageChanged(new MessageChangedEvent(this, Set.of()));

        verify(networkAlertsCache).clear();
        ArgumentCaptor<Object> payloadCaptor = ArgumentCaptor.forClass(Object.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/network-map"), payloadCaptor.capture());
        @SuppressWarnings("unchecked")
        Map<String, Object> payload = (Map<String, Object>) payloadCaptor.getValue();
        assertThat(payload).containsEntry("type", "ALERTS_UPDATE");
        assertThat(payload).containsKey("alerts");
        assertThat(payload).doesNotContainKey("networkMap");
    }

    @Test
    @DisplayName("handles null cache gracefully during eviction")
    void handlesNullCacheGracefully() {
        when(cacheManager.getCache("networkMap")).thenReturn(null);
        when(cacheManager.getCache("networkAlerts")).thenReturn(null);
        when(networkMapService.getNetworkMap()).thenReturn(emptyMap());
        when(networkMapService.getAlerts()).thenReturn(emptyAlerts());
        when(activeDisplayTracker.hasNetworkMapSubscribers()).thenReturn(true);

        // Should not throw
        publisher.onNetworkChanged(new NetworkChangedEvent(this, Set.of()));
    }
}
