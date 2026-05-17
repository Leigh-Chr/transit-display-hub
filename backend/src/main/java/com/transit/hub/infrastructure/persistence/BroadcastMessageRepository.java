package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.BroadcastMessage;
import com.transit.hub.domain.model.enums.MessageScope;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Repository
public interface BroadcastMessageRepository
        extends JpaRepository<BroadcastMessage, UUID>, JpaSpecificationExecutor<BroadcastMessage> {

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

    // The seven specific filter-combination paged queries that used to
    // live here (findActiveMessages(Pageable), findBySearch, findActiveBySearch,
    // findBySeverity, findBySeverityAndSearch, findActiveBySeverity,
    // findActiveBySeverityAndSearch) have been removed — every paged call
    // now goes through JpaSpecificationExecutor.findAll(Specification, Pageable)
    // and the spec is assembled in MessageService.
}
