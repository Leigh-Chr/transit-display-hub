package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.ImportAudit;
import com.transit.hub.domain.model.enums.ImportStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ImportAuditRepository extends JpaRepository<ImportAudit, UUID> {

    /** Most recent attempts first; used by the admin timeline. */
    @Query("SELECT a FROM ImportAudit a ORDER BY a.startedAt DESC")
    List<ImportAudit> findRecent(Pageable pageable);

    /**
     * Returns the hash recorded on the most recent successful import,
     * if any. Used by the orchestrator to skip a re-import when the
     * feed bytes are unchanged.
     */
    @Query("""
            SELECT a FROM ImportAudit a
            WHERE a.status = :status AND a.sourceHash IS NOT NULL
            ORDER BY a.startedAt DESC
            """)
    List<ImportAudit> findLastByStatus(ImportStatus status, Pageable pageable);

    default Optional<ImportAudit> findLastSuccessfulWithHash() {
        List<ImportAudit> rows = findLastByStatus(ImportStatus.SUCCESS,
                org.springframework.data.domain.PageRequest.of(0, 1));
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.getFirst());
    }
}
