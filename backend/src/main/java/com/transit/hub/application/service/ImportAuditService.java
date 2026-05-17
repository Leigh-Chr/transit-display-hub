package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.ImportAuditResponse;
import com.transit.hub.domain.model.ImportAudit;
import com.transit.hub.infrastructure.persistence.ImportAuditRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ImportAuditService {

    private final ImportAuditRepository auditRepository;

    private static final int DEFAULT_LIMIT = 50;
    private static final int MAX_LIMIT = 200;

    /** The runner only writes these three files; any other path the
     *  caller asks for is rejected without touching the disk. Keeps
     *  the file-serving endpoint from doubling as a directory
     *  traversal sink. */
    private static final Set<String> VALIDATION_REPORT_FILES =
            Set.of("report.json", "report.html", "system_errors.json");

    @Transactional(readOnly = true)
    public List<ImportAuditResponse> getRecent(Integer limit) {
        int safeLimit = Math.min(MAX_LIMIT, Math.max(1, limit == null ? DEFAULT_LIMIT : limit));
        return auditRepository.findRecent(PageRequest.of(0, safeLimit)).stream()
                .map(ImportAuditResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public Optional<ImportAuditResponse> getById(UUID auditId) {
        return auditRepository.findById(auditId).map(ImportAuditResponse::from);
    }

    /**
     * Reads a single MobilityData report file off disk for the given
     * audit. Returns {@link Optional#empty()} when the audit doesn't
     * exist, validation never ran, or the requested file is missing —
     * the controller maps that to a 404. The whitelist on
     * {@code reportFileName} keeps a crafted query string from
     * escaping the audit's own directory.
     */
    @Transactional(readOnly = true)
    public Optional<byte[]> readValidationReport(UUID auditId, String reportFileName) throws IOException {
        if (!VALIDATION_REPORT_FILES.contains(reportFileName)) {
            return Optional.empty();
        }
        Optional<ImportAudit> audit = auditRepository.findById(auditId);
        if (audit.isEmpty() || audit.get().getValidationReportDir() == null) {
            return Optional.empty();
        }
        Path file = Paths.get(audit.get().getValidationReportDir()).resolve(reportFileName);
        if (!Files.exists(file)) {
            log.debug("Validation report file {} missing for audit {}",
                    reportFileName, auditId);
            return Optional.empty();
        }
        return Optional.of(Files.readAllBytes(file));
    }
}
