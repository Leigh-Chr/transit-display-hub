package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.BookingRuleResponse;
import com.transit.hub.application.support.UnpaginatedCap;
import com.transit.hub.infrastructure.persistence.BookingRuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class BookingRuleService {

    private final BookingRuleRepository bookingRuleRepository;

    /** Returns every booking rule sorted by booking type ordinal
     *  (real-time first, then same-day, then prior-days) for a stable
     *  admin browse experience. */
    @Transactional(readOnly = true)
    public List<BookingRuleResponse> browse() {
        return UnpaginatedCap.findAllCapped(
                        bookingRuleRepository, log, "BookingRuleService.browse")
                .stream()
                .sorted(Comparator
                        .comparing((com.transit.hub.domain.model.BookingRule b) -> b.getBookingType().ordinal())
                        .thenComparing(com.transit.hub.domain.model.BookingRule::getExternalId))
                .map(BookingRuleResponse::from)
                .toList();
    }

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
