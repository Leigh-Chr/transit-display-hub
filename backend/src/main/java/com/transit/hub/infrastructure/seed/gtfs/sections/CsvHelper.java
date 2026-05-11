package com.transit.hub.infrastructure.seed.gtfs.sections;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Shared CSV parsing helpers used by every section importer.
 * Extracted so each importer stays free of boilerplate.
 */
final class CsvHelper {

    private CsvHelper() {}

    static CSVParser openCsv(Path file) throws IOException {
        return CSVFormat.DEFAULT.builder()
                .setHeader()
                .setSkipHeaderRecord(true)
                .setIgnoreSurroundingSpaces(true)
                .setIgnoreEmptyLines(true)
                .build()
                .parse(Files.newBufferedReader(file, StandardCharsets.UTF_8));
    }

    static String optional(CSVRecord record, String column) {
        return record.isMapped(column) ? record.get(column) : "";
    }
}
