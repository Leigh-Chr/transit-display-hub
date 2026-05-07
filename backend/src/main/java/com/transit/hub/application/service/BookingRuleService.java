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

    /** Returns every booking rule sorted by booking type ordinal
     *  (real-time first, then same-day, then prior-days) for a stable
     *  admin browse experience. */
    @Transactional(readOnly = true)
    public List<BookingRuleResponse> browse() {
        return bookingRuleRepository.findAll().stream()
                .sorted(Comparator
                        .comparing((com.transit.hub.domain.model.BookingRule b) -> b.getBookingType().ordinal())
                        .thenComparing(com.transit.hub.domain.model.BookingRule::getExternalId))
                .map(BookingRuleResponse::from)
                .toList();
    }
}
