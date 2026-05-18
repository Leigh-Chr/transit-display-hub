package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.BookingRuleResponse;
import com.transit.hub.infrastructure.persistence.BookingRuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BookingRuleService {

    private final BookingRuleRepository bookingRuleRepository;

    /** Booking rules attached to schedules / flex_stop_times bound to
     *  this stop. Used by the public stop popup to render booking
     *  instructions for an on-demand pickup/drop-off. */
    @Transactional(readOnly = true)
    public List<BookingRuleResponse> findByStopId(java.util.UUID stopId) {
        return bookingRuleRepository.findByStopId(stopId).stream()
                .sorted(Comparator
                        .comparing((com.transit.hub.domain.model.BookingRule b) -> b.getBookingType().ordinal())
                        .thenComparing(com.transit.hub.domain.model.BookingRule::getExternalId))
                .map(BookingRuleResponse::from)
                .toList();
    }
}
