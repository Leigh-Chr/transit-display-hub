package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.Translation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TranslationRepository extends JpaRepository<Translation, UUID> {

    /** Bulk load for the "load everything for this language at boot" path. */
    List<Translation> findByLanguage(String language);
}
