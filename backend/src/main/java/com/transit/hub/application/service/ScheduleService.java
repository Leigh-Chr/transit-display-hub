package com.transit.hub.application.service;

import com.transit.hub.application.dto.request.CreateScheduleRequest;
import com.transit.hub.application.dto.response.ScheduleResponse;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.domain.event.ScheduleChangedEvent;
import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Schedule;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.infrastructure.persistence.ItineraryRepository;
import com.transit.hub.infrastructure.persistence.ScheduleRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
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

    private final ScheduleRepository scheduleRepository;
    private final StopRepository stopRepository;
    private final ItineraryRepository itineraryRepository;
    private final ApplicationEventPublisher eventPublisher;

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");

    @Transactional(readOnly = true)
    public List<ScheduleResponse> getScheduleForStop(UUID stopId) {
        if (!stopRepository.existsById(stopId)) {
            throw new EntityNotFoundException("Stop", stopId);
        }
        return scheduleRepository.findByStopIdWithItineraryOrderByTime(stopId).stream()
                .map(ScheduleResponse::from)
                .toList();
    }

    @Transactional
    public ScheduleResponse createSchedule(UUID stopId, CreateScheduleRequest request) {
        Stop stop = stopRepository.findByIdWithLines(stopId)
                .orElseThrow(() -> new EntityNotFoundException("Stop", stopId));

        Itinerary itinerary = itineraryRepository.findByIdWithLineAndStops(request.itineraryId())
                .orElseThrow(() -> new EntityNotFoundException("Itinerary", request.itineraryId()));

        Line line = itinerary.getLine();

        // Validate that the itinerary's line belongs to this stop
        if (!stop.getLines().contains(line)) {
            throw new IllegalArgumentException("Itinerary's line " + line.getCode() + " is not associated with stop " + stop.getName());
        }

        LocalTime time = LocalTime.parse(request.time(), TIME_FORMATTER);

        // Check for duplicate entry
        if (scheduleRepository.existsByStopIdAndItineraryIdAndTime(stopId, itinerary.getId(), time)) {
            throw new IllegalArgumentException(
                "A schedule entry already exists for itinerary " + itinerary.getName() +
                " at " + time.format(TIME_FORMATTER) + " at this stop");
        }

        Schedule schedule = Schedule.builder()
                .time(time)
                .stop(stop)
                .itinerary(itinerary)
                .build();

        Schedule saved = scheduleRepository.save(schedule);
        eventPublisher.publishEvent(new ScheduleChangedEvent(this, stopId));
        return ScheduleResponse.from(saved);
    }

    @Transactional
    public ScheduleResponse updateSchedule(UUID id, CreateScheduleRequest request) {
        Schedule schedule = scheduleRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Schedule", id));

        Stop stop = stopRepository.findByIdWithLines(schedule.getStop().getId())
                .orElseThrow(() -> new EntityNotFoundException("Stop", schedule.getStop().getId()));

        Itinerary itinerary = itineraryRepository.findByIdWithLineAndStops(request.itineraryId())
                .orElseThrow(() -> new EntityNotFoundException("Itinerary", request.itineraryId()));

        Line line = itinerary.getLine();

        // Validate that the itinerary's line belongs to this stop
        if (!stop.getLines().contains(line)) {
            throw new IllegalArgumentException("Itinerary's line " + line.getCode() + " is not associated with stop " + stop.getName());
        }

        LocalTime time = LocalTime.parse(request.time(), TIME_FORMATTER);

        // Check for duplicate entry (excluding the current one)
        if (scheduleRepository.existsByStopIdAndItineraryIdAndTimeExcludingId(
                stop.getId(), itinerary.getId(), time, schedule.getId())) {
            throw new IllegalArgumentException(
                "A schedule entry already exists for itinerary " + itinerary.getName() +
                " at " + time.format(TIME_FORMATTER) + " at this stop");
        }

        schedule.setTime(time);
        schedule.setItinerary(itinerary);

        Schedule saved = scheduleRepository.save(schedule);
        eventPublisher.publishEvent(new ScheduleChangedEvent(this, schedule.getStop().getId()));
        return ScheduleResponse.from(saved);
    }

    @Transactional
    public void deleteSchedule(UUID id) {
        Schedule schedule = scheduleRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Schedule", id));

        UUID stopId = schedule.getStop().getId();
        scheduleRepository.delete(schedule);
        eventPublisher.publishEvent(new ScheduleChangedEvent(this, stopId));
    }
}
