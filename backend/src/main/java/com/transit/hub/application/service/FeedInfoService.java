package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.FeedInfoResponse;
import com.transit.hub.infrastructure.persistence.FeedInfoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class FeedInfoService {

    private final FeedInfoRepository feedInfoRepository;

    /**
     * Returns the singleton feed metadata when a feed has been imported,
     * otherwise empty. The endpoint stays under {@code /api/admin/} so an
     * empty result is the legitimate state for installs that have not yet
     * pulled a GTFS feed.
     */
    @Transactional(readOnly = true)
    public Optional<FeedInfoResponse> getFeedInfo() {
        return feedInfoRepository.findSingleton().map(FeedInfoResponse::from);
    }
}
