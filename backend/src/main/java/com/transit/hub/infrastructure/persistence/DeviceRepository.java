package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.Device;
import com.transit.hub.domain.model.enums.DeviceStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DeviceRepository extends JpaRepository<Device, UUID> {
    Optional<Device> findByTokenHash(String tokenHash);

    List<Device> findByStatus(DeviceStatus status);

    List<Device> findByStopId(UUID stopId);

    @Query("SELECT d FROM Device d WHERE d.status = 'ONLINE' AND d.lastHeartbeat < :threshold")
    List<Device> findStaleOnlineDevices(Instant threshold);

    @Query("SELECT DISTINCT d FROM Device d JOIN FETCH d.stop s LEFT JOIN FETCH s.lines")
    List<Device> findAllWithStopAndLine();
}
