package com.transit.hub.bench;

import com.transit.hub.domain.util.ColorContrast;
import org.openjdk.jmh.annotations.Benchmark;
import org.openjdk.jmh.annotations.BenchmarkMode;
import org.openjdk.jmh.annotations.Mode;
import org.openjdk.jmh.annotations.OutputTimeUnit;
import org.openjdk.jmh.annotations.Scope;
import org.openjdk.jmh.annotations.State;
import org.openjdk.jmh.infra.Blackhole;

import java.util.concurrent.TimeUnit;

/**
 * {@link ColorContrast} is touched once per Line on import (when
 * {@code route_text_color} is missing), then on every render of the
 * line-badge backplate when an admin override or legacy row replays
 * the calculation. Tiny op, but called on every line of every feed —
 * a regression here would surface as a visible UI judder on big imports.
 */
@State(Scope.Benchmark)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.NANOSECONDS)
public class ColorContrastBenchmark {

    private static final String[] BACKGROUNDS = {
            "#FF5733", "#1E88E5", "#FFC107", "#43A047", "#8E24AA",
            "#000000", "#FFFFFF", "#888", "#abc", "not-a-color",
    };

    @Benchmark
    public String singleSixDigitColor() {
        return ColorContrast.readableTextColor("#1E88E5");
    }

    @Benchmark
    public String singleThreeDigitColor() {
        return ColorContrast.readableTextColor("#abc");
    }

    @Benchmark
    public String malformedFallback() {
        return ColorContrast.readableTextColor("not-a-color");
    }

    @Benchmark
    public void mixedBatch(Blackhole bh) {
        for (String bg : BACKGROUNDS) {
            bh.consume(ColorContrast.readableTextColor(bg));
        }
    }
}
