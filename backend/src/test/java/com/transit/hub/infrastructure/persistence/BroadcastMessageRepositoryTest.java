package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.BroadcastMessage;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.LineType;
import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.domain.model.enums.MessageSeverity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.cache.autoconfigure.CacheAutoConfiguration;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ImportAutoConfiguration(CacheAutoConfiguration.class)
@ActiveProfiles("test")
@DisplayName("BroadcastMessageRepository")
class BroadcastMessageRepositoryTest {

    @Autowired
    private BroadcastMessageRepository repository;

    @Autowired
    private TestEntityManager em;

    private Instant now;
    private Line line1;
    private Line line2;
    private Stop stop1;
    private Stop stop2;

    @BeforeEach
    void setUp() {
        // Truncate to microseconds to match H2's timestamp precision
        now = Instant.now().truncatedTo(ChronoUnit.MICROS);

        line1 = Line.builder()
                .code("L1")
                .name("Metro Line 1")
                .color("#FF5733")
                .type(LineType.METRO)
                .build();
        em.persist(line1);

        line2 = Line.builder()
                .code("L2")
                .name("Bus Line 2")
                .color("#3377FF")
                .type(LineType.BUS)
                .build();
        em.persist(line2);

        stop1 = Stop.builder().name("Central Station").build();
        stop1.addLine(line1);
        em.persist(stop1);

        stop2 = Stop.builder().name("North Station").build();
        stop2.addLine(line2);
        em.persist(stop2);

        em.flush();
        em.clear();
    }

    private BroadcastMessage persistMessage(String title, String content, MessageSeverity severity,
                                            Instant startTime, Instant endTime,
                                            MessageScope scopeType, UUID scopeId) {
        BroadcastMessage msg = BroadcastMessage.builder()
                .title(title)
                .content(content)
                .severity(severity)
                .startTime(startTime)
                .endTime(endTime)
                .scopeType(scopeType)
                .scopeId(scopeId)
                .build();
        em.persist(msg);
        return msg;
    }

    @Nested
    @DisplayName("findActiveMessages")
    class FindActiveMessages {

        @Test
        @DisplayName("returns only messages where startTime <= now AND endTime > now")
        void returnsOnlyActiveMessages() {
            // Active: started 1h ago, ends 1h from now
            persistMessage("Active", "content", MessageSeverity.INFO,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            // Expired: started 3h ago, ended 1h ago
            persistMessage("Expired", "content", MessageSeverity.INFO,
                    now.minus(3, ChronoUnit.HOURS), now.minus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            // Future: starts 1h from now, ends 3h from now
            persistMessage("Future", "content", MessageSeverity.INFO,
                    now.plus(1, ChronoUnit.HOURS), now.plus(3, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            em.flush();
            em.clear();

            List<BroadcastMessage> result = repository.findActiveMessages(now);

            assertThat(result).hasSize(1);
            assertThat(result.getFirst().getTitle()).isEqualTo("Active");
        }

        @Test
        @DisplayName("includes message where startTime equals now (startTime <= now)")
        void includesMessageWhereStartTimeEqualsNow() {
            persistMessage("Starts Now", "content", MessageSeverity.INFO,
                    now, now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            em.flush();
            em.clear();

            List<BroadcastMessage> result = repository.findActiveMessages(now);

            assertThat(result).hasSize(1);
            assertThat(result.getFirst().getTitle()).isEqualTo("Starts Now");
        }

        @Test
        @DisplayName("excludes message where endTime equals now (endTime > now, not >=)")
        void excludesMessageWhereEndTimeEqualsNow() {
            persistMessage("Ends Now", "content", MessageSeverity.INFO,
                    now.minus(1, ChronoUnit.HOURS), now,
                    MessageScope.NETWORK, null);
            em.flush();
            em.clear();

            List<BroadcastMessage> result = repository.findActiveMessages(now);

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("orders by severity: CRITICAL first, then WARNING, then INFO")
        void orderedBySeverityCriticalFirst() {
            persistMessage("Info Alert", "content", MessageSeverity.INFO,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            persistMessage("Critical Alert", "content", MessageSeverity.CRITICAL,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            persistMessage("Warning Alert", "content", MessageSeverity.WARNING,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            em.flush();
            em.clear();

            List<BroadcastMessage> result = repository.findActiveMessages(now);

            assertThat(result).hasSize(3);
            assertThat(result.get(0).getSeverity()).isEqualTo(MessageSeverity.CRITICAL);
            assertThat(result.get(1).getSeverity()).isEqualTo(MessageSeverity.WARNING);
            assertThat(result.get(2).getSeverity()).isEqualTo(MessageSeverity.INFO);
        }

        @Test
        @DisplayName("within same severity, orders by startTime descending (most recent first)")
        void withinSameSeverityOrdersByStartTimeDesc() {
            BroadcastMessage older = persistMessage("Older", "content", MessageSeverity.WARNING,
                    now.minus(3, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            BroadcastMessage newer = persistMessage("Newer", "content", MessageSeverity.WARNING,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            em.flush();
            em.clear();

            List<BroadcastMessage> result = repository.findActiveMessages(now);

            assertThat(result).hasSize(2);
            assertThat(result.get(0).getTitle()).isEqualTo("Newer");
            assertThat(result.get(1).getTitle()).isEqualTo("Older");
        }

        @Test
        @DisplayName("returns empty list when no active messages exist")
        void returnsEmptyWhenNoActiveMessages() {
            persistMessage("Expired", "content", MessageSeverity.INFO,
                    now.minus(3, ChronoUnit.HOURS), now.minus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            em.flush();
            em.clear();

            List<BroadcastMessage> result = repository.findActiveMessages(now);

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("findActiveMessagesForStop")
    class FindActiveMessagesForStop {

        @Test
        @DisplayName("returns NETWORK scoped messages regardless of lineIds/stopId")
        void returnsNetworkScopedMessages() {
            persistMessage("Network Alert", "content", MessageSeverity.INFO,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            em.flush();
            em.clear();

            List<BroadcastMessage> result = repository.findActiveMessagesForStop(
                    now, Set.of(line1.getId()), stop1.getId());

            assertThat(result).hasSize(1);
            assertThat(result.getFirst().getScopeType()).isEqualTo(MessageScope.NETWORK);
        }

        @Test
        @DisplayName("returns LINE scoped messages when lineId is in the provided set")
        void returnsLineScopedMessagesForMatchingLine() {
            persistMessage("Line 1 Alert", "content", MessageSeverity.INFO,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.LINE, line1.getId());
            em.flush();
            em.clear();

            List<BroadcastMessage> result = repository.findActiveMessagesForStop(
                    now, Set.of(line1.getId()), stop1.getId());

            assertThat(result).hasSize(1);
            assertThat(result.getFirst().getScopeType()).isEqualTo(MessageScope.LINE);
        }

        @Test
        @DisplayName("excludes LINE scoped messages when lineId is not in the provided set")
        void excludesLineScopedMessagesForNonMatchingLine() {
            persistMessage("Line 2 Alert", "content", MessageSeverity.INFO,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.LINE, line2.getId());
            em.flush();
            em.clear();

            List<BroadcastMessage> result = repository.findActiveMessagesForStop(
                    now, Set.of(line1.getId()), stop1.getId());

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("returns STOP scoped messages for the matching stopId")
        void returnsStopScopedMessagesForMatchingStop() {
            persistMessage("Stop 1 Alert", "content", MessageSeverity.INFO,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.STOP, stop1.getId());
            em.flush();
            em.clear();

            List<BroadcastMessage> result = repository.findActiveMessagesForStop(
                    now, Set.of(line1.getId()), stop1.getId());

            assertThat(result).hasSize(1);
            assertThat(result.getFirst().getScopeType()).isEqualTo(MessageScope.STOP);
        }

        @Test
        @DisplayName("excludes STOP scoped messages for a different stopId")
        void excludesStopScopedMessagesForDifferentStop() {
            persistMessage("Stop 2 Alert", "content", MessageSeverity.INFO,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.STOP, stop2.getId());
            em.flush();
            em.clear();

            List<BroadcastMessage> result = repository.findActiveMessagesForStop(
                    now, Set.of(line1.getId()), stop1.getId());

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("combines all three scope types in a single query")
        void combinesAllThreeScopeTypes() {
            persistMessage("Network Alert", "content", MessageSeverity.CRITICAL,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            persistMessage("Line Alert", "content", MessageSeverity.WARNING,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.LINE, line1.getId());
            persistMessage("Stop Alert", "content", MessageSeverity.INFO,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.STOP, stop1.getId());
            // Should be excluded: LINE for line2, STOP for stop2
            persistMessage("Line 2 Alert", "content", MessageSeverity.INFO,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.LINE, line2.getId());
            persistMessage("Stop 2 Alert", "content", MessageSeverity.INFO,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.STOP, stop2.getId());
            em.flush();
            em.clear();

            List<BroadcastMessage> result = repository.findActiveMessagesForStop(
                    now, Set.of(line1.getId()), stop1.getId());

            assertThat(result).hasSize(3);
            assertThat(result.get(0).getSeverity()).isEqualTo(MessageSeverity.CRITICAL);
            assertThat(result.get(1).getSeverity()).isEqualTo(MessageSeverity.WARNING);
            assertThat(result.get(2).getSeverity()).isEqualTo(MessageSeverity.INFO);
        }

        @Test
        @DisplayName("excludes inactive messages even if scope matches")
        void excludesInactiveMessages() {
            persistMessage("Expired Network", "content", MessageSeverity.INFO,
                    now.minus(3, ChronoUnit.HOURS), now.minus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            persistMessage("Future Stop", "content", MessageSeverity.INFO,
                    now.plus(1, ChronoUnit.HOURS), now.plus(3, ChronoUnit.HOURS),
                    MessageScope.STOP, stop1.getId());
            em.flush();
            em.clear();

            List<BroadcastMessage> result = repository.findActiveMessagesForStop(
                    now, Set.of(line1.getId()), stop1.getId());

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("works with multiple lineIds in the set")
        void worksWithMultipleLineIds() {
            persistMessage("Line 1 Alert", "content", MessageSeverity.WARNING,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.LINE, line1.getId());
            persistMessage("Line 2 Alert", "content", MessageSeverity.INFO,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.LINE, line2.getId());
            em.flush();
            em.clear();

            List<BroadcastMessage> result = repository.findActiveMessagesForStop(
                    now, Set.of(line1.getId(), line2.getId()), stop1.getId());

            assertThat(result).hasSize(2);
        }

        @Test
        @DisplayName("returns empty result with empty lineIds set and no matching stop messages")
        void emptyLineIdsReturnsOnlyNetworkAndStopMessages() {
            persistMessage("Line Alert", "content", MessageSeverity.INFO,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.LINE, line1.getId());
            persistMessage("Network Alert", "content", MessageSeverity.CRITICAL,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            em.flush();
            em.clear();

            UUID randomStopId = UUID.randomUUID();
            List<BroadcastMessage> result = repository.findActiveMessagesForStop(
                    now, Set.of(), randomStopId);

            // Should return only network (no line match with empty set, no stop match)
            assertThat(result).hasSize(1);
            assertThat(result.getFirst().getScopeType()).isEqualTo(MessageScope.NETWORK);
        }
    }

    @Nested
    @DisplayName("findBySearch")
    class FindBySearch {

        @Test
        @DisplayName("finds messages by case-insensitive title match")
        void findsByTitleCaseInsensitive() {
            persistMessage("Emergency Alert", "normal content", MessageSeverity.CRITICAL,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            persistMessage("Regular Notice", "nothing special", MessageSeverity.INFO,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            em.flush();
            em.clear();

            Page<BroadcastMessage> result = repository.findBySearch("emergency", PageRequest.of(0, 10));

            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().getFirst().getTitle()).isEqualTo("Emergency Alert");
        }

        @Test
        @DisplayName("finds messages by case-insensitive content match")
        void findsByContentCaseInsensitive() {
            persistMessage("Alert 1", "Track maintenance scheduled", MessageSeverity.WARNING,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            persistMessage("Alert 2", "Normal service", MessageSeverity.INFO,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            em.flush();
            em.clear();

            Page<BroadcastMessage> result = repository.findBySearch("MAINTENANCE", PageRequest.of(0, 10));

            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().getFirst().getContent()).contains("maintenance");
        }

        @Test
        @DisplayName("finds messages matching in either title or content")
        void findsByTitleOrContent() {
            persistMessage("Delay Notice", "Trains running normally", MessageSeverity.INFO,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            persistMessage("Service Update", "Expected delay on line 1", MessageSeverity.WARNING,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            persistMessage("All Clear", "No issues", MessageSeverity.INFO,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            em.flush();
            em.clear();

            Page<BroadcastMessage> result = repository.findBySearch("delay", PageRequest.of(0, 10));

            assertThat(result.getContent()).hasSize(2);
        }

        @Test
        @DisplayName("returns empty page when no messages match the search")
        void returnsEmptyWhenNoMatch() {
            persistMessage("Test Alert", "Test content", MessageSeverity.INFO,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            em.flush();
            em.clear();

            Page<BroadcastMessage> result = repository.findBySearch("nonexistent", PageRequest.of(0, 10));

            assertThat(result.getContent()).isEmpty();
            assertThat(result.getTotalElements()).isZero();
        }

        @Test
        @DisplayName("supports partial text matching")
        void supportsPartialMatch() {
            persistMessage("Emergency Alert", "content", MessageSeverity.CRITICAL,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            em.flush();
            em.clear();

            Page<BroadcastMessage> result = repository.findBySearch("merg", PageRequest.of(0, 10));

            assertThat(result.getContent()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("findActiveBySearch")
    class FindActiveBySearch {

        @Test
        @DisplayName("returns only active messages matching the search")
        void returnsOnlyActiveMatchingMessages() {
            // Active + matches search
            persistMessage("Emergency Alert", "active content", MessageSeverity.CRITICAL,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            // Expired + matches search
            persistMessage("Emergency Notice", "expired content", MessageSeverity.WARNING,
                    now.minus(3, ChronoUnit.HOURS), now.minus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            // Active + does not match search
            persistMessage("Regular Notice", "nothing here", MessageSeverity.INFO,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            em.flush();
            em.clear();

            Page<BroadcastMessage> result = repository.findActiveBySearch(now, "emergency", PageRequest.of(0, 10));

            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().getFirst().getTitle()).isEqualTo("Emergency Alert");
        }
    }

    @Nested
    @DisplayName("findBySeverityAndSearch")
    class FindBySeverityAndSearch {

        @Test
        @DisplayName("filters by both severity and search term")
        void filtersBySeverityAndSearch() {
            persistMessage("Critical Alert", "system failure", MessageSeverity.CRITICAL,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            persistMessage("Warning Alert", "system slow", MessageSeverity.WARNING,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            persistMessage("Critical Update", "all resolved", MessageSeverity.CRITICAL,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            em.flush();
            em.clear();

            Page<BroadcastMessage> result = repository.findBySeverityAndSearch(
                    MessageSeverity.CRITICAL, "system", PageRequest.of(0, 10));

            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().getFirst().getTitle()).isEqualTo("Critical Alert");
        }

        @Test
        @DisplayName("returns empty when severity matches but search does not")
        void returnsEmptyWhenSearchDoesNotMatch() {
            persistMessage("Critical Alert", "system down", MessageSeverity.CRITICAL,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            em.flush();
            em.clear();

            Page<BroadcastMessage> result = repository.findBySeverityAndSearch(
                    MessageSeverity.CRITICAL, "nonexistent", PageRequest.of(0, 10));

            assertThat(result.getContent()).isEmpty();
        }

        @Test
        @DisplayName("returns empty when search matches but severity does not")
        void returnsEmptyWhenSeverityDoesNotMatch() {
            persistMessage("Critical Alert", "system down", MessageSeverity.CRITICAL,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            em.flush();
            em.clear();

            Page<BroadcastMessage> result = repository.findBySeverityAndSearch(
                    MessageSeverity.INFO, "system", PageRequest.of(0, 10));

            assertThat(result.getContent()).isEmpty();
        }
    }

    @Nested
    @DisplayName("findActiveBySeverity")
    class FindActiveBySeverity {

        @Test
        @DisplayName("filters by both active status and severity")
        void filtersByActiveAndSeverity() {
            // Active + CRITICAL
            persistMessage("Active Critical", "content", MessageSeverity.CRITICAL,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            // Active + WARNING
            persistMessage("Active Warning", "content", MessageSeverity.WARNING,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            // Expired + CRITICAL
            persistMessage("Expired Critical", "content", MessageSeverity.CRITICAL,
                    now.minus(3, ChronoUnit.HOURS), now.minus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            em.flush();
            em.clear();

            Page<BroadcastMessage> result = repository.findActiveBySeverity(
                    now, MessageSeverity.CRITICAL, PageRequest.of(0, 10));

            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().getFirst().getTitle()).isEqualTo("Active Critical");
        }
    }

    @Nested
    @DisplayName("findActiveBySeverityAndSearch")
    class FindActiveBySeverityAndSearch {

        @Test
        @DisplayName("filters by active status, severity, and search term simultaneously")
        void filtersByAllThreeCriteria() {
            // Active + CRITICAL + matches search
            persistMessage("Critical System Failure", "system is down", MessageSeverity.CRITICAL,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            // Active + CRITICAL + does not match search
            persistMessage("Critical Database Error", "db connection lost", MessageSeverity.CRITICAL,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            // Active + WARNING + matches search
            persistMessage("System Slowdown", "system is slow", MessageSeverity.WARNING,
                    now.minus(1, ChronoUnit.HOURS), now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            // Expired + CRITICAL + matches search
            persistMessage("Old System Outage", "system was down", MessageSeverity.CRITICAL,
                    now.minus(3, ChronoUnit.HOURS), now.minus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK, null);
            em.flush();
            em.clear();

            Page<BroadcastMessage> result = repository.findActiveBySeverityAndSearch(
                    now, MessageSeverity.CRITICAL, "system", PageRequest.of(0, 10));

            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().getFirst().getTitle()).isEqualTo("Critical System Failure");
        }
    }
}
