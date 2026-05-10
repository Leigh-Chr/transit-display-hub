package com.transit.hub.application.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.mobilitydata.gtfsvalidator.input.CountryCode;
import org.mobilitydata.gtfsvalidator.runner.ApplicationType;
import org.mobilitydata.gtfsvalidator.runner.ValidationRunner;
import org.mobilitydata.gtfsvalidator.runner.ValidationRunnerConfig;
import org.mobilitydata.gtfsvalidator.util.VersionResolver;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.Optional;

/**
 * Wraps the canonical MobilityData {@code gtfs-validator} so the
 * import-audit page can surface the same warnings and errors the
 * upstream tool would report — without having to upload the feed
 * elsewhere. Each call returns a {@link ValidationResult} pointing
 * at the JSON / HTML / system-errors reports the runner wrote on
 * disk; the caller is responsible for serving or persisting them.
 *
 * <p>Wired via Spring so the same instance is reusable across
 * imports; the underlying runner has no per-call state to flush.
 *
 * <p>Validation runs in the calling thread and is bounded by the
 * runner's own thread pool ({@code numThreads} below). The default
 * country code is {@code FR} since the reference deployment is
 * Grenoble; callers can override per-call when known.
 */
@Service
@Slf4j
public class GtfsValidatorService {

    private static final String REPORT_JSON = "report.json";
    private static final String REPORT_HTML = "report.html";
    private static final String SYSTEM_ERRORS_JSON = "system_errors.json";

    /**
     * Locations of the three artifacts the runner writes on success
     * and a boolean telling the caller whether the validator itself
     * completed without an internal failure (notice severities are
     * orthogonal to this — even a feed with errors will return
     * {@code success = true} as long as the runner ran).
     */
    public record ValidationResult(
            boolean success,
            Path reportJsonPath,
            Path reportHtmlPath,
            Path systemErrorsPath) {}

    /**
     * Pre-computed counts of the notices the runner emitted, broken
     * down by severity. Lets callers render a "23 errors / 7
     * warnings" badge without re-parsing report.json on every read.
     */
    public record NoticeSummary(int errorCount, int warningCount, int infoCount) {

        public static NoticeSummary empty() {
            return new NoticeSummary(0, 0, 0);
        }
    }

    public ValidationResult validate(Path feedZip, Path outputDirectory) throws IOException {
        return validate(feedZip, outputDirectory, "FR", LocalDate.now());
    }

    public ValidationResult validate(Path feedZip,
                                     Path outputDirectory,
                                     String countryCodeIso,
                                     LocalDate dateForValidation) throws IOException {
        Files.createDirectories(outputDirectory);
        Path storageDir = outputDirectory.resolve("storage");
        Files.createDirectories(storageDir);

        ValidationRunnerConfig config = ValidationRunnerConfig.builder()
                .setGtfsSource(feedZip.toUri())
                .setOutputDirectory(Optional.of(outputDirectory))
                .setStorageDirectory(storageDir)
                .setValidationReportFileName(REPORT_JSON)
                .setHtmlReportFileName(REPORT_HTML)
                .setSystemErrorsReportFileName(SYSTEM_ERRORS_JSON)
                .setNumThreads(Math.max(2, Runtime.getRuntime().availableProcessors() / 2))
                .setCountryCode(CountryCode.forStringOrUnknown(countryCodeIso))
                .setDateForValidation(dateForValidation)
                .setPrettyJson(true)
                // We never want the validator to phone home for an
                // update check — the version is pinned via Gradle.
                .setSkipValidatorUpdate(true)
                .setStdoutOutput(false)
                .build();

        VersionResolver versionResolver = new VersionResolver(ApplicationType.WEB);
        ValidationRunner runner = new ValidationRunner(versionResolver);
        ValidationRunner.Status status = runner.run(config);

        boolean success = status == ValidationRunner.Status.SUCCESS;
        log.info("MobilityData gtfs-validator returned status={} for feed={}",
                status, feedZip);

        return new ValidationResult(
                success,
                outputDirectory.resolve(REPORT_JSON),
                outputDirectory.resolve(REPORT_HTML),
                outputDirectory.resolve(SYSTEM_ERRORS_JSON));
    }

    /**
     * Parses the {@code notices} array from a runner report and tallies
     * the entries by severity. Returns an empty summary when the file
     * is missing or malformed — caller decides whether to surface that
     * as a UI warning. Each notice carries a {@code totalNotices}
     * count (the runner already groups individual occurrences by
     * code), so the summation is over groups, not occurrences.
     */
    public NoticeSummary summarize(Path reportJsonPath) {
        if (reportJsonPath == null || !Files.exists(reportJsonPath)) {
            return NoticeSummary.empty();
        }
        try {
            JsonNode root = new ObjectMapper().readTree(reportJsonPath.toFile());
            JsonNode notices = root.path("notices");
            int errors = 0;
            int warnings = 0;
            int infos = 0;
            for (JsonNode notice : notices) {
                int total = notice.path("totalNotices").asInt(0);
                String severity = notice.path("severity").asText("");
                switch (severity) {
                    case "ERROR" -> errors += total;
                    case "WARNING" -> warnings += total;
                    case "INFO" -> infos += total;
                    default -> log.debug("Unknown notice severity '{}' in {}",
                            severity, reportJsonPath);
                }
            }
            return new NoticeSummary(errors, warnings, infos);
        } catch (IOException e) {
            log.warn("Failed to summarise validation report at {}: {}",
                    reportJsonPath, e.getMessage());
            return NoticeSummary.empty();
        }
    }
}
