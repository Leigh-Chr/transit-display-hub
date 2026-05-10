package com.transit.hub.application.exception;

public class EntityNotFoundException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    public EntityNotFoundException(String message) {
        super(message);
    }

    public EntityNotFoundException(String entityName, Object id) {
        super(entityName + " with ID " + id + " not found");
    }
}
