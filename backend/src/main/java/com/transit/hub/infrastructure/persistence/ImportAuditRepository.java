package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.ImportAudit;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ImportAuditRepository extends JpaRepository<ImportAudit, UUID> {

    /** Most recent attempts first; used by the admin timeline. */
    @Query("SELECT a FROM ImportAudit a ORDER BY a.startedAt DESC")
    List<ImportAudit> findRecent(Pageable pageable);
}
