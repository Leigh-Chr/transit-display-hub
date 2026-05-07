package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.BookingRuleResponse;
import com.transit.hub.application.service.BookingRuleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Admin browse endpoint over the GTFS demand-responsive booking rules.
 * Lets operators audit the booking-channel data — phone, URL, advance
 * notice — before it gets surfaced on a future passenger UI.
 */
@RestController
@RequestMapping("/api/admin/booking-rules")
@RequiredArgsConstructor
public class BookingRuleController {

    private final BookingRuleService bookingRuleService;

    @GetMapping
    public ResponseEntity<List<BookingRuleResponse>> browse() {
        return ResponseEntity.ok(bookingRuleService.browse());
    }
}
