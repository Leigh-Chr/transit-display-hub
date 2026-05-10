package com.transit.hub.api.rest;

import com.transit.hub.application.dto.request.RegisterDeviceRequest;
import com.transit.hub.application.dto.response.DeviceRegistrationResponse;
import com.transit.hub.application.dto.response.DeviceResponse;
import com.transit.hub.application.service.DeviceService;
import com.transit.hub.domain.model.enums.DeviceStatus;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/devices")
@RequiredArgsConstructor
@Tag(name = "Administration — appareils",
     description = "Enregistrement et supervision des écrans déployés (kiosques) et leurs jetons.")
public class DeviceController {

    private final DeviceService deviceService;

    @GetMapping
    public ResponseEntity<List<DeviceResponse>> getDevices(
            @RequestParam(required = false) DeviceStatus status
    ) {
        if (status != null) {
            return ResponseEntity.ok(deviceService.getDevicesByStatus(status));
        }
        return ResponseEntity.ok(deviceService.getAllDevices());
    }

    @GetMapping("/{id}")
    public ResponseEntity<DeviceResponse> getDevice(@PathVariable UUID id) {
        return ResponseEntity.ok(deviceService.getDevice(id));
    }

    @PostMapping
    public ResponseEntity<DeviceRegistrationResponse> registerDevice(@Valid @RequestBody RegisterDeviceRequest request) {
        DeviceRegistrationResponse response = deviceService.registerDevice(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{id}")
    public ResponseEntity<DeviceResponse> updateDevice(
            @PathVariable UUID id,
            @Valid @RequestBody RegisterDeviceRequest request
    ) {
        return ResponseEntity.ok(deviceService.updateDevice(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDevice(@PathVariable UUID id) {
        deviceService.deleteDevice(id);
        return ResponseEntity.noContent().build();
    }
}
