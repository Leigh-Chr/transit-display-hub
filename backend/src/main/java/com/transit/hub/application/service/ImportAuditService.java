package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.ImportAuditResponse;
import com.transit.hub.infrastructure.persistence.ImportAuditRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ImportAuditService {

    private final ImportAuditRepository auditRepository;

    private static final int DEFAULT_LIMIT = 50;
    private static final int MAX_LIMIT = 200;

    @Transactional(readOnly = true)
    public List<ImportAuditResponse> getRecent(Integer limit) {
        int safeLimit = Math.min(MAX_LIMIT, Math.max(1, limit == null ? DEFAULT_LIMIT : limit));
        return auditRepository.findRecent(PageRequest.of(0, safeLimit)).stream()
                .map(ImportAuditResponse::from)
                .toList();
    }
}
