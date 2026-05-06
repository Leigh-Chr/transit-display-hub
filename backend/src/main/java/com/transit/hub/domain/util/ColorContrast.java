package com.transit.hub.domain.util;

/**
 * Color-contrast helpers. The single public method derives a foreground hex
 * color (black or white) that stays legible on top of an arbitrary
 * background hex color.
 * <p>
 * The YIQ luminance formula and the 160 threshold mirror
 * {@code frontend/src/app/shared/utils/color.utils.ts} so the same brand
 * color always resolves to the same text color regardless of whether the
 * value was pre-computed at import time, derived live in the front-end,
 * or filled in by a service when an admin omits it.
 */
public final class ColorContrast {

    private static final String DARK_TEXT = "#1A1A1A";
    private static final String LIGHT_TEXT = "#FFFFFF";
    private static final int LUMINANCE_THRESHOLD = 160;

    private ColorContrast() {}

    /**
     * Returns {@code "#1A1A1A"} (near-black) when {@code backgroundHex} is
     * light enough to support dark text, otherwise {@code "#FFFFFF"}.
     * <p>
     * Accepts {@code "#RGB"}, {@code "#RRGGBB"} and the same forms without
     * the leading {@code #}. Falls back to white text on malformed input.
     */
    public static String readableTextColor(String backgroundHex) {
        if (backgroundHex == null || backgroundHex.isBlank()) {
            return LIGHT_TEXT;
        }
        String raw = backgroundHex.trim();
        if (raw.startsWith("#")) {
            raw = raw.substring(1);
        }
        if (raw.length() == 3) {
            StringBuilder sb = new StringBuilder(6);
            for (int i = 0; i < 3; i++) {
                char c = raw.charAt(i);
                sb.append(c).append(c);
            }
            raw = sb.toString();
        }
        if (raw.length() != 6) {
            return LIGHT_TEXT;
        }
        try {
            int r = Integer.parseInt(raw.substring(0, 2), 16);
            int g = Integer.parseInt(raw.substring(2, 4), 16);
            int b = Integer.parseInt(raw.substring(4, 6), 16);
            int yiq = (r * 299 + g * 587 + b * 114) / 1000;
            return yiq >= LUMINANCE_THRESHOLD ? DARK_TEXT : LIGHT_TEXT;
        } catch (NumberFormatException e) {
            return LIGHT_TEXT;
        }
    }
}
