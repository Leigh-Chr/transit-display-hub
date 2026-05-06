package com.transit.hub.application.service;

import com.transit.hub.application.dto.request.AddItineraryStopRequest;
import com.transit.hub.application.dto.request.CreateItineraryRequest;
import com.transit.hub.application.dto.request.UpdateItineraryStopsRequest;
import com.transit.hub.application.dto.response.ItineraryResponse;
import com.transit.hub.application.dto.response.PageResponse;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.application.exception.ValidationException;
import com.transit.hub.domain.event.NetworkChangedEvent;
import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.ItineraryStop;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.infrastructure.persistence.ItineraryRepository;
import com.transit.hub.infrastructure.persistence.ItineraryStopRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ItineraryService {

    private final ItineraryRepository itineraryRepository;
    private final ItineraryStopRepository itineraryStopRepository;
    private final LineRepository lineRepository;
    private final StopRepository stopRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional(readOnly = true)
    public List<ItineraryResponse> getAllItineraries() {
        return itineraryRepository.findAllWithLineAndStops().stream()
                .map(ItineraryResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public ItineraryResponse getItinerary(UUID id) {
        return itineraryRepository.findByIdWithLineAndStops(id)
                .map(ItineraryResponse::from)
                .orElseThrow(() -> new EntityNotFoundException("Itinerary", id));
    }

    @Transactional(readOnly = true)
    public List<ItineraryResponse> getItinerariesByLine(UUID lineId) {
        if (!lineRepository.existsById(lineId)) {
            throw new EntityNotFoundException("Line", lineId);
        }
        return itineraryRepository.findByLineIdWithLineAndStops(lineId).stream()
                .map(ItineraryResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<ItineraryResponse> getAllItineraries(UUID lineId, String search, Pageable pageable) {
        Page<Itinerary> page;
        boolean hasLineId = lineId != null;
        boolean hasSearch = search != null && !search.isBlank();
        String trimmedSearch = hasSearch ? search.trim() : null;

        if (hasLineId && hasSearch) {
            page = itineraryRepository.findByLineIdAndSearchWithLine(lineId, trimmedSearch, pageable);
        } else if (hasLineId) {
            page = itineraryRepository.findByLineIdWithLine(lineId, pageable);
        } else if (hasSearch) {
            page = itineraryRepository.findBySearchWithLine(trimmedSearch, pageable);
        } else {
            page = itineraryRepository.findAllWithLine(pageable);
        }
        return PageResponse.from(page, ItineraryResponse::from);
    }

    @Transactional
    public ItineraryResponse createItinerary(CreateItineraryRequest request) {
        Line line = lineRepository.findById(request.lineId())
                .orElseThrow(() -> new EntityNotFoundException("Line", request.lineId()));

        if (itineraryRepository.existsByLineIdAndName(request.lineId(), request.name())) {
            throw new ValidationException("Itinerary with name '" + request.name() + "' already exists for line " + line.getCode());
        }

        Itinerary itinerary = Itinerary.builder()
                .line(line)
                .name(request.name())
                .itineraryStops(new ArrayList<>())
                .build();

        Itinerary saved = itineraryRepository.save(itinerary);

        // Add stops if provided
        if (request.stopIds() != null && !request.stopIds().isEmpty()) {
            addStopsToItinerary(saved, request.stopIds());
        }

        publishNetworkChanged(saved);
        return ItineraryResponse.from(itineraryRepository.findByIdWithLineAndStops(saved.getId()).orElseThrow());
    }

    @Transactional
    public ItineraryResponse updateItinerary(UUID id, CreateItineraryRequest request) {
        Itinerary itinerary = itineraryRepository.findByIdWithLine(id)
                .orElseThrow(() -> new EntityNotFoundException("Itinerary", id));

        Line line = lineRepository.findById(request.lineId())
                .orElseThrow(() -> new EntityNotFoundException("Line", request.lineId()));

        if (itineraryRepository.existsByLineIdAndNameExcludingId(request.lineId(), request.name(), id)) {
            throw new ValidationException("Itinerary with name '" + request.name() + "' already exists for line " + line.getCode());
        }

        itinerary.setLine(line);
        itinerary.setName(request.name());

        // Update stops if provided
        if (request.stopIds() != null) {
            itineraryStopRepository.deleteByItineraryId(id);
            itinerary.getItineraryStops().clear();
            if (!request.stopIds().isEmpty()) {
                addStopsToItinerary(itinerary, request.stopIds());
            }
        }

        itineraryRepository.save(itinerary);
        publishNetworkChanged(itinerary);
        return ItineraryResponse.from(itineraryRepository.findByIdWithLineAndStops(id).orElseThrow());
    }

    @Transactional
    public void deleteItinerary(UUID id) {
        Itinerary itinerary = itineraryRepository.findByIdWithLineAndStops(id)
                .orElseThrow(() -> new EntityNotFoundException("Itinerary", id));
        Set<UUID> affectedStopIds = getStopIds(itinerary);
        itineraryStopRepository.deleteByItineraryId(id);
        itineraryRepository.deleteById(id);
        eventPublisher.publishEvent(new NetworkChangedEvent(this, affectedStopIds));
    }

    @Transactional
    public ItineraryResponse updateItineraryStops(UUID id, UpdateItineraryStopsRequest request) {
        Itinerary itinerary = itineraryRepository.findByIdWithLine(id)
                .orElseThrow(() -> new EntityNotFoundException("Itinerary", id));

        itineraryStopRepository.deleteByItineraryId(id);
        itinerary.getItineraryStops().clear();

        if (request.stopIds() != null && !request.stopIds().isEmpty()) {
            addStopsToItinerary(itinerary, request.stopIds());
        }

        itineraryRepository.save(itinerary);
        publishNetworkChanged(itinerary);
        return ItineraryResponse.from(itineraryRepository.findByIdWithLineAndStops(id).orElseThrow());
    }

    @Transactional
    public ItineraryResponse addStopToItinerary(UUID itineraryId, AddItineraryStopRequest request) {
        Itinerary itinerary = itineraryRepository.findByIdWithLineAndStops(itineraryId)
                .orElseThrow(() -> new EntityNotFoundException("Itinerary", itineraryId));

        Stop stop = stopRepository.findById(request.stopId())
                .orElseThrow(() -> new EntityNotFoundException("Stop", request.stopId()));

        if (itineraryStopRepository.existsByItineraryIdAndStopId(itineraryId, request.stopId())) {
            throw new ValidationException("Stop '" + stop.getName() + "' is already in this itinerary");
        }

        int position;
        if (request.position() != null) {
            position = request.position();
            // Atomic bulk shift via SQL — touching one row at a time through JPA
            // would intermittently violate the (itinerary_id, position) unique
            // constraint as positions cross each other.
            itineraryStopRepository.shiftPositionsFrom(itineraryId, position);
            // The shift cleared the persistence context (clearAutomatically=true);
            // re-load the itinerary so the new ItineraryStop attaches to a managed entity.
            itinerary = itineraryRepository.findByIdWithLineAndStops(itineraryId).orElseThrow();
            stop = stopRepository.findById(request.stopId()).orElseThrow();
        } else {
            Integer maxPosition = itineraryStopRepository.findMaxPositionByItineraryId(itineraryId);
            position = (maxPosition != null) ? maxPosition + 1 : 0;
        }

        ItineraryStop itineraryStop = ItineraryStop.builder()
                .itinerary(itinerary)
                .stop(stop)
                .position(position)
                .build();

        itinerary.getItineraryStops().add(itineraryStop);
        itineraryRepository.save(itinerary);
        eventPublisher.publishEvent(new NetworkChangedEvent(this, Set.of(request.stopId())));

        return ItineraryResponse.from(itineraryRepository.findByIdWithLineAndStops(itineraryId).orElseThrow());
    }

    @Transactional
    public ItineraryResponse removeStopFromItinerary(UUID itineraryId, UUID stopId) {
        Itinerary itinerary = itineraryRepository.findByIdWithLineAndStops(itineraryId)
                .orElseThrow(() -> new EntityNotFoundException("Itinerary", itineraryId));

        if (!stopRepository.existsById(stopId)) {
            throw new EntityNotFoundException("Stop", stopId);
        }

        boolean removed = itinerary.getItineraryStops().removeIf(is -> is.getStop().getId().equals(stopId));
        if (!removed) {
            throw new ValidationException("Stop is not part of this itinerary");
        }

        // Reorder remaining stops
        List<ItineraryStop> stops = new ArrayList<>(itinerary.getItineraryStops());
        stops.sort((a, b) -> a.getPosition().compareTo(b.getPosition()));
        for (int i = 0; i < stops.size(); i++) {
            stops.get(i).setPosition(i);
        }

        itineraryRepository.save(itinerary);
        eventPublisher.publishEvent(new NetworkChangedEvent(this, Set.of(stopId)));
        return ItineraryResponse.from(itineraryRepository.findByIdWithLineAndStops(itineraryId).orElseThrow());
    }

    @Transactional(readOnly = true)
    public Itinerary getItineraryEntity(UUID id) {
        return itineraryRepository.findByIdWithLineAndStops(id)
                .orElseThrow(() -> new EntityNotFoundException("Itinerary", id));
    }

    private void publishNetworkChanged(Itinerary itinerary) {
        Set<UUID> affectedStopIds = getStopIds(itinerary);
        eventPublisher.publishEvent(new NetworkChangedEvent(this, affectedStopIds));
    }

    private Set<UUID> getStopIds(Itinerary itinerary) {
        Set<UUID> stopIds = new HashSet<>();
        for (ItineraryStop is : itinerary.getItineraryStops()) {
            stopIds.add(is.getStop().getId());
        }
        return stopIds;
    }

    private void addStopsToItinerary(Itinerary itinerary, List<UUID> stopIds) {
        for (int i = 0; i < stopIds.size(); i++) {
            UUID stopId = stopIds.get(i);
            Stop stop = stopRepository.findById(stopId)
                    .orElseThrow(() -> new EntityNotFoundException("Stop", stopId));

            ItineraryStop itineraryStop = ItineraryStop.builder()
                    .itinerary(itinerary)
                    .stop(stop)
                    .position(i)
                    .build();

            itinerary.getItineraryStops().add(itineraryStop);
        }
    }
}
