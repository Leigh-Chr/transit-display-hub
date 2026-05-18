/**
 * Application DTO root package. The actual records live in the
 * {@code request} and {@code response} sub-packages, both
 * {@code @NullMarked} on their own. This file pins the convention
 * at the parent level so any future DTO type added directly here
 * inherits the same default.
 */
@NullMarked
package com.transit.hub.application.dto;

import org.jspecify.annotations.NullMarked;
