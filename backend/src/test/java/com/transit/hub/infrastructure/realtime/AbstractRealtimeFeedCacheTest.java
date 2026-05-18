package com.transit.hub.infrastructure.realtime;

import com.google.transit.realtime.GtfsRealtime;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Covers the HTTP fetch / parse / atomic-replace loop on
 * {@link AbstractRealtimeFeedCache}. Each test spins up a tiny
 * {@link HttpServer} on an ephemeral port so the live {@link HttpClient}
 * round-trip runs without crossing the network.
 */
class AbstractRealtimeFeedCacheTest {

    private HttpServer server;

    @AfterEach
    void tearDown() {
        if (server != null) {
            server.stop(0);
            server = null;
        }
    }

    @Test
    void isEnabled_returnsFalseWhenUrlBlank() {
        TestCache cache = new TestCache("", HttpClient.newHttpClient());
        assertFalse(cache.isEnabled());
    }

    @Test
    void isEnabled_returnsFalseWhenUrlNull() {
        TestCache cache = new TestCache(null, HttpClient.newHttpClient());
        assertFalse(cache.isEnabled());
    }

    @Test
    void getSnapshot_returnsEmptyUntilFirstRefresh() {
        TestCache cache = new TestCache("", HttpClient.newHttpClient());
        assertNotNull(cache.getSnapshot());
        assertTrue(cache.getSnapshot().isEmpty());
    }

    @Test
    void refresh_isNoOpWhenDisabled() {
        TestCache cache = new TestCache("", HttpClient.newHttpClient());
        cache.refresh();
        assertEquals(0, cache.parseCallCount.get());
    }

    @Test
    void refresh_replacesSnapshotOn200Response() throws Exception {
        byte[] payload = buildFeedWithEntities("alert-1", "alert-2", "alert-3").toByteArray();
        startServer(payload, 200);

        TestCache cache = new TestCache(url(), HttpClient.newHttpClient());
        cache.refresh();

        assertEquals(3, cache.getSnapshot().size());
        assertEquals(1, cache.parseCallCount.get());
    }

    @Test
    void refresh_keepsPreviousSnapshotOnNon200() throws Exception {
        // First fill the cache, then have the server return 500 — the
        // previous snapshot must stick around.
        byte[] firstPayload = buildFeedWithEntities("alert-1").toByteArray();
        startServer(firstPayload, 200);

        TestCache cache = new TestCache(url(), HttpClient.newHttpClient());
        cache.refresh();
        assertEquals(1, cache.getSnapshot().size());

        switchServerTo(500, new byte[0]);
        cache.refresh();

        assertEquals(1, cache.getSnapshot().size(), "previous snapshot must survive HTTP 500");
        assertEquals(1, cache.parseCallCount.get(), "parseSnapshot should not be called on non-200");
    }

    @Test
    void refresh_storesHeaderInfoOnSuccess() throws Exception {
        byte[] payload = buildFeedWithEntities("alert-1").toByteArray();
        startServer(payload, 200);

        TestCache cache = new TestCache(url(), HttpClient.newHttpClient());
        cache.refresh();

        FeedHeaderInfo header = cache.currentHeader();
        assertNotNull(header);
    }

    // --- helpers ------------------------------------------------------

    private void startServer(byte[] body, int status) throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/feed", exchange -> {
            exchange.sendResponseHeaders(status, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
    }

    private void switchServerTo(int status, byte[] body) {
        server.removeContext("/feed");
        server.createContext("/feed", exchange -> {
            exchange.sendResponseHeaders(status, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
    }

    private String url() {
        return "http://127.0.0.1:" + server.getAddress().getPort() + "/feed";
    }

    private static GtfsRealtime.FeedMessage buildFeedWithEntities(String... ids) {
        GtfsRealtime.FeedMessage.Builder b = GtfsRealtime.FeedMessage.newBuilder()
                .setHeader(GtfsRealtime.FeedHeader.newBuilder()
                        .setGtfsRealtimeVersion("2.0")
                        .setTimestamp(1_716_000_000L)
                        .build());
        for (String id : ids) {
            b.addEntity(GtfsRealtime.FeedEntity.newBuilder()
                    .setId(id)
                    .setAlert(GtfsRealtime.Alert.newBuilder().build())
                    .build());
        }
        return b.build();
    }

    /** Minimal concrete subclass whose snapshot is just a list of entity ids
     *  — enough to assert the refresh loop populated it. */
    private static final class TestCache extends AbstractRealtimeFeedCache<List<String>> {
        private final String url;
        private final AtomicInteger parseCallCount = new AtomicInteger();

        TestCache(String url, HttpClient http) {
            super(http);
            this.url = url;
            // Override the initial snapshot now that the field is set —
            // the parent's constructor placed emptySnapshot() in the ref
            // but called it before url was assigned.
            snapshot.set(emptySnapshot());
        }

        @Override
        protected String feedUrl() { return url; }

        @Override
        protected int timeoutSeconds() { return 5; }

        @Override
        protected String kindLabel() { return "test"; }

        @Override
        protected List<String> parseSnapshot(GtfsRealtime.FeedMessage feed) {
            parseCallCount.incrementAndGet();
            return feed.getEntityList().stream()
                    .map(GtfsRealtime.FeedEntity::getId)
                    .toList();
        }

        @Override
        protected List<String> emptySnapshot() { return List.of(); }

        @Override
        protected int countEntries(List<String> snap) { return snap.size(); }
    }
}
