package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.Device;
import com.transit.hub.domain.model.enums.DeviceStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface DeviceRepository extends JpaRepository<Device, UUID> {

    List<Device> findByTokenLookup(String tokenLookup);

    List<Device> findByStatus(DeviceStatus status);

    long countByStatus(DeviceStatus status);

    List<Device> findByStopId(UUID stopId);

    @Query("SELECT d FROM Device d WHERE d.status = 'ONLINE' AND d.lastHeartbeat < :threshold")
    List<Device> findStaleOnlineDevices(Instant threshold);

    @Query("SELECT DISTINCT d FROM Device d JOIN FETCH d.stop s LEFT JOIN FETCH s.lines")
    List<Device> findAllWithStopAndLine();

    /**
     * Two-step pagination helper: page over device ids without JOIN FETCH
     * so Hibernate paginates in SQL, then hydrate the page in a second
     * query through {@link #findAllByIdInWithStopAndLine}.
     */
    @Query("SELECT d.id FROM Device d")
    Page<UUID> findAllIds(Pageable pageable);

    @Query("SELECT DISTINCT d FROM Device d JOIN FETCH d.stop s LEFT JOIN FETCH s.lines WHERE d.id IN :ids")
    List<Device> findAllByIdInWithStopAndLine(List<UUID> ids);

    void deleteByStopId(UUID stopId);
}
