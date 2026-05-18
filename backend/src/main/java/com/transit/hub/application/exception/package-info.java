/**
 * Application-layer exceptions — translated to HTTP responses by
 * {@code GlobalExceptionHandler}. {@code @NullMarked} forces the
 * {@code message} / {@code cause} surface to spell when null is
 * actually a valid value (it rarely is for thrown errors).
 */
@NullMarked
package com.transit.hub.application.exception;

import org.jspecify.annotations.NullMarked;
