package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.Transfer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TransferRepository extends JpaRepository<Transfer, UUID> {

    /** Eagerly fetches both stops so the network-map serialiser doesn't
     *  trigger N+1 queries when emitting the inline transfer list. */
    @Query("SELECT t FROM Transfer t JOIN FETCH t.fromStop JOIN FETCH t.toStop")
    List<Transfer> findAllWithStops();
}
