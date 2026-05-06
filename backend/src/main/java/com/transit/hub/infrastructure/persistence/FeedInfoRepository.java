package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.FeedInfo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface FeedInfoRepository extends JpaRepository<FeedInfo, UUID> {

    /**
     * Returns the singleton {@link FeedInfo} row when one exists.
     * The schema permits multiple rows (no UNIQUE constraint on the
     * sentinel), but the import service always replaces in place — this
     * helper hides that invariant from callers.
     */
    default Optional<FeedInfo> findSingleton() {
        return findAll().stream().findFirst();
    }
}
