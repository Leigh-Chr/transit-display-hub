/**
 * Application services — the orchestration layer between controllers
 * and the domain / infrastructure. {@code @NullMarked} keeps method
 * contracts honest: a {@code @Nullable} return forces the caller to
 * branch on the absence, and a {@code @Nullable} parameter documents
 * that the method tolerates null (think: anonymous principal,
 * optional filter, missing token).
 */
@NullMarked
package com.transit.hub.application.service;

import org.jspecify.annotations.NullMarked;
