package com.transit.hub.application.exception;

import java.text.MessageFormat;
import java.util.Locale;
import java.util.ResourceBundle;

/**
 * Carrier for a validation failure that needs to surface to the API
 * caller as a 400. Supports two modes:
 *  - legacy literal message (kept for back-compat with call sites that
 *    have not yet been migrated)
 *  - message key + args, resolved by GlobalExceptionHandler against
 *    the MessageSource so the rendered text honours Accept-Language
 *
 * For the keyed variant, super(message) still carries a readable
 * English preview formatted from the bundle so logs and existing
 * tests that read getMessage() keep working — the localized rendering
 * happens later in GlobalExceptionHandler when the request locale is
 * known.
 */
public class ValidationException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    private static final ResourceBundle EN_BUNDLE = ResourceBundle.getBundle(
            "messages",
            Locale.ENGLISH,
            ResourceBundle.Control.getNoFallbackControl(ResourceBundle.Control.FORMAT_DEFAULT));

    private final String messageKey;
    private final transient Object[] messageArgs;

    public ValidationException(String message) {
        super(message);
        this.messageKey = null;
        this.messageArgs = null;
    }

    private ValidationException(String key, Object[] args) {
        super(renderEnglishPreview(key, args));
        this.messageKey = key;
        this.messageArgs = args;
    }

    /** Factory for the i18n-aware variant — pass the message bundle key
     *  and any positional args ({0}, {1}, …). */
    public static ValidationException ofKey(String key, Object... args) {
        return new ValidationException(key, args);
    }

    public String getMessageKey() {
        return messageKey;
    }

    public Object[] getMessageArgs() {
        return messageArgs == null ? null : messageArgs.clone();
    }

    private static String renderEnglishPreview(String key, Object[] args) {
        if (!EN_BUNDLE.containsKey(key)) {
            return key;
        }
        String template = EN_BUNDLE.getString(key);
        return (args == null || args.length == 0) ? template : MessageFormat.format(template, args);
    }
}
