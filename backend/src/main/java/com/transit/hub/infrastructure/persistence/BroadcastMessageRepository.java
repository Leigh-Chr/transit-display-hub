package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.BroadcastMessage;
import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.domain.model.enums.MessageSeverity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Repository
public interface BroadcastMessageRepository extends JpaRepository<BroadcastMessage, UUID> {

    // Order by severity: CRITICAL (0) > WARNING (1) > INFO (2), then by most recent
    @Query("SELECT m FROM BroadcastMessage m WHERE m.startTime <= :now AND m.endTime > :now " +
            "ORDER BY CASE m.severity WHEN 'CRITICAL' THEN 0 WHEN 'WARNING' THEN 1 ELSE 2 END, m.startTime DESC")
    List<BroadcastMessage> findActiveMessages(Instant now);

    @Query("SELECT DISTINCT m FROM BroadcastMessage m WHERE m.startTime <= :now AND m.endTime > :now AND " +
            "(m.scopeType = 'NETWORK' OR " +
            "(m.scopeType = 'LINE' AND m.scopeId IN :lineIds) OR " +
            "(m.scopeType = 'STOP' AND m.scopeId = :stopId)) " +
            "ORDER BY CASE m.severity WHEN 'CRITICAL' THEN 0 WHEN 'WARNING' THEN 1 ELSE 2 END, m.startTime DESC")
    List<BroadcastMessage> findActiveMessagesForStop(Instant now, Set<UUID> lineIds, UUID stopId);

    void deleteByScopeTypeAndScopeId(MessageScope scopeType, UUID scopeId);

    Page<BroadcastMessage> findAll(Pageable pageable);

    @Query("SELECT m FROM BroadcastMessage m WHERE m.startTime <= :now AND m.endTime > :now")
    Page<BroadcastMessage> findActiveMessages(Instant now, Pageable pageable);

    @Query("SELECT m FROM BroadcastMessage m WHERE " +
           "LOWER(m.title) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(m.content) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<BroadcastMessage> findBySearch(String search, Pageable pageable);

    @Query("SELECT m FROM BroadcastMessage m WHERE m.startTime <= :now AND m.endTime > :now AND " +
           "(LOWER(m.title) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(m.content) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<BroadcastMessage> findActiveBySearch(Instant now, String search, Pageable pageable);

    Page<BroadcastMessage> findBySeverity(MessageSeverity severity, Pageable pageable);

    @Query("SELECT m FROM BroadcastMessage m WHERE m.severity = :severity AND " +
           "(LOWER(m.title) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(m.content) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<BroadcastMessage> findBySeverityAndSearch(MessageSeverity severity, String search, Pageable pageable);

    @Query("SELECT m FROM BroadcastMessage m WHERE m.severity = :severity AND " +
           "m.startTime <= :now AND m.endTime > :now")
    Page<BroadcastMessage> findActiveBySeverity(Instant now, MessageSeverity severity, Pageable pageable);

    @Query("SELECT m FROM BroadcastMessage m WHERE m.severity = :severity AND " +
           "m.startTime <= :now AND m.endTime > :now AND " +
           "(LOWER(m.title) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(m.content) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<BroadcastMessage> findActiveBySeverityAndSearch(Instant now, MessageSeverity severity, String search, Pageable pageable);
}
