package com.transit.hub.application.service;

import com.transit.hub.application.dto.request.CreateTimedEntryRequest;
import com.transit.hub.application.dto.response.TimedEntryResponse;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.domain.event.ScheduleChangedEvent;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.TimedEntry;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.persistence.TimedEntryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ScheduleService {

    private final TimedEntryRepository timedEntryRepository;
    private final StopRepository stopRepository;
    private final ApplicationEventPublisher eventPublisher;

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");

    @Transactional(readOnly = true)
    public List<TimedEntryResponse> getScheduleForStop(UUID stopId) {
        if (!stopRepository.existsById(stopId)) {
            throw new EntityNotFoundException("Stop", stopId);
        }
        return timedEntryRepository.findByStopIdOrderByTime(stopId).stream()
                .map(TimedEntryResponse::from)
                .toList();
    }

    @Transactional
    public TimedEntryResponse createTimedEntry(UUID stopId, CreateTimedEntryRequest request) {
        Stop stop = stopRepository.findById(stopId)
                .orElseThrow(() -> new EntityNotFoundException("Stop", stopId));

        LocalTime time = LocalTime.parse(request.time(), TIME_FORMATTER);

        TimedEntry entry = TimedEntry.builder()
                .time(time)
                .stop(stop)
                .build();

        TimedEntry saved = timedEntryRepository.save(entry);
        eventPublisher.publishEvent(new ScheduleChangedEvent(this, stopId));
        return TimedEntryResponse.from(saved);
    }

    @Transactional
    public TimedEntryResponse updateTimedEntry(UUID id, CreateTimedEntryRequest request) {
        TimedEntry entry = timedEntryRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("TimedEntry", id));

        LocalTime time = LocalTime.parse(request.time(), TIME_FORMATTER);
        entry.setTime(time);

        TimedEntry saved = timedEntryRepository.save(entry);
        eventPublisher.publishEvent(new ScheduleChangedEvent(this, entry.getStop().getId()));
        return TimedEntryResponse.from(saved);
    }

    @Transactional
    public void deleteTimedEntry(UUID id) {
        TimedEntry entry = timedEntryRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("TimedEntry", id));

        UUID stopId = entry.getStop().getId();
        timedEntryRepository.delete(entry);
        eventPublisher.publishEvent(new ScheduleChangedEvent(this, stopId));
    }
}
