package com.transit.hub.bench;

import com.transit.hub.domain.model.Translation;
import com.transit.hub.domain.util.TranslationLookup;
import org.openjdk.jmh.annotations.Benchmark;
import org.openjdk.jmh.annotations.BenchmarkMode;
import org.openjdk.jmh.annotations.Mode;
import org.openjdk.jmh.annotations.OutputTimeUnit;
import org.openjdk.jmh.annotations.Param;
import org.openjdk.jmh.annotations.Scope;
import org.openjdk.jmh.annotations.Setup;
import org.openjdk.jmh.annotations.State;
import org.openjdk.jmh.infra.Blackhole;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Measures the two hot operations on {@link TranslationLookup}: building
 * the map from a translations slice (once per language switch / cache
 * warm-up) and resolving a single key (once per kiosk arrival on
 * multilingual feeds).
 *
 * <p>The size sweep covers the realistic ranges:
 * 100 ≈ a small bus operator with stop / line names, 1k ≈ a metro feed
 * with stops + lines + headsigns, 10k ≈ a regional rail feed including
 * trip-level translations.
 */
@State(Scope.Benchmark)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.MICROSECONDS)
public class TranslationLookupBenchmark {

    @Param({"100", "1000", "10000"})
    public int size;

    private List<Translation> translations;
    private TranslationLookup lookup;
    private String hitTable;
    private String hitRecordId;
    private String hitField;

    @Setup
    public void setUp() {
        translations = new ArrayList<>(size);
        for (int i = 0; i < size; i++) {
            translations.add(Translation.builder()
                    .tableName(i % 2 == 0 ? "stops" : "routes")
                    .recordId("R" + i)
                    .fieldName("stop_name")
                    .language("fr")
                    .translation("Arrêt " + i)
                    .build());
        }
        lookup = TranslationLookup.from(translations);
        // Pick a key from the middle so the lookup hashes and compares
        // a non-trivial string each iteration.
        int mid = size / 2;
        hitTable = mid % 2 == 0 ? "stops" : "routes";
        hitRecordId = "R" + mid;
        hitField = "stop_name";
    }

    @Benchmark
    public TranslationLookup buildFromCollection() {
        return TranslationLookup.from(translations);
    }

    @Benchmark
    public String resolveHit() {
        return lookup.resolveOr(hitTable, hitRecordId, hitField, "fallback");
    }

    @Benchmark
    public String resolveMiss() {
        return lookup.resolveOr("stops", "MISSING_ID", "stop_name", "fallback");
    }

    @Benchmark
    public void resolveBatch(Blackhole bh) {
        // Approximates a kiosk refresh where every arrival hits the lookup
        // a few times (stop name, line name, headsign).
        for (int i = 0; i < 16; i++) {
            bh.consume(lookup.resolveOr(hitTable, hitRecordId, hitField, "fallback"));
        }
    }
}
