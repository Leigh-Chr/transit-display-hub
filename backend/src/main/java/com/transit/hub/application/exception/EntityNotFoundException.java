package com.transit.hub.application.exception;

import org.jspecify.annotations.Nullable;

/**
 * Raised when a service cannot find the addressed entity. Surfaces as
 * a 404 through GlobalExceptionHandler.
 *
 * The (entityName, id) constructor records an i18n key so the handler
 * renders the message in the caller's language; the (message) one
 * keeps the legacy hardcoded path for the rare sites that don't fit
 * the entity/id shape.
 */
public class EntityNotFoundException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    private final @Nullable String messageKey;
    private final transient Object @Nullable [] messageArgs;

    public EntityNotFoundException(String message) {
        super(message);
        this.messageKey = null;
        this.messageArgs = null;
    }

    public EntityNotFoundException(String entityName, Object id) {
        super(entityName + " with ID " + id + " not found");
        this.messageKey = "error.entity.notFoundWithId";
        this.messageArgs = new Object[] { entityName, id };
    }

    public @Nullable String getMessageKey() {
        return messageKey;
    }

    public Object @Nullable [] getMessageArgs() {
        return messageArgs == null ? null : messageArgs.clone();
    }
}
