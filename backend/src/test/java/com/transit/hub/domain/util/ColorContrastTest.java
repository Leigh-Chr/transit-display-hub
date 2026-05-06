package com.transit.hub.domain.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("ColorContrast.readableTextColor")
class ColorContrastTest {

    @ParameterizedTest(name = "{0} → dark text")
    @CsvSource({
            "#FFFFFF",
            "#FFEB00", // RATP yellow
            "#FFFF00", // pure yellow
            "#FFD700", // gold
            "#90EE90", // light green
            "#FFC0CB", // pink
            "#F0F8FF", // alice blue
    })
    @DisplayName("returns dark text on light backgrounds")
    void lightBackgrounds(String bg) {
        assertThat(ColorContrast.readableTextColor(bg)).isEqualTo("#1A1A1A");
    }

    @ParameterizedTest(name = "{0} → light text")
    @CsvSource({
            "#000000",
            "#0078D4", // azure / Microsoft blue
            "#1E88E5", // material blue
            "#E53935", // material red
            "#43A047", // material green
            "#8E24AA", // purple
    })
    @DisplayName("returns light text on dark backgrounds")
    void darkBackgrounds(String bg) {
        assertThat(ColorContrast.readableTextColor(bg)).isEqualTo("#FFFFFF");
    }

    @Test
    @DisplayName("expands the 3-character shorthand")
    void shorthand() {
        assertThat(ColorContrast.readableTextColor("#fff")).isEqualTo("#1A1A1A");
        assertThat(ColorContrast.readableTextColor("#000")).isEqualTo("#FFFFFF");
        assertThat(ColorContrast.readableTextColor("#f00")).isEqualTo("#FFFFFF");
    }

    @Test
    @DisplayName("accepts hex without the leading hash")
    void noLeadingHash() {
        assertThat(ColorContrast.readableTextColor("FFEB00")).isEqualTo("#1A1A1A");
        assertThat(ColorContrast.readableTextColor("0078D4")).isEqualTo("#FFFFFF");
        assertThat(ColorContrast.readableTextColor("fff")).isEqualTo("#1A1A1A");
    }

    @Test
    @DisplayName("falls back to white on malformed input")
    void malformed() {
        assertThat(ColorContrast.readableTextColor(null)).isEqualTo("#FFFFFF");
        assertThat(ColorContrast.readableTextColor("")).isEqualTo("#FFFFFF");
        assertThat(ColorContrast.readableTextColor("   ")).isEqualTo("#FFFFFF");
        assertThat(ColorContrast.readableTextColor("not-a-color")).isEqualTo("#FFFFFF");
        assertThat(ColorContrast.readableTextColor("#zzz")).isEqualTo("#FFFFFF");
        assertThat(ColorContrast.readableTextColor("#1234")).isEqualTo("#FFFFFF");
        assertThat(ColorContrast.readableTextColor("#1234567")).isEqualTo("#FFFFFF");
    }
}
