/**
 * {@code @RestControllerAdvice} handlers translating domain exceptions
 * into RFC 7807 problem responses. {@code @NullMarked} keeps the
 * handlers honest — a {@code ProblemDetail} field that the spec marks
 * optional is the only place {@code @Nullable} lands.
 */
@NullMarked
package com.transit.hub.api.advice;

import org.jspecify.annotations.NullMarked;
