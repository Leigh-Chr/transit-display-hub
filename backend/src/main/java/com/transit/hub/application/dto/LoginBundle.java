package com.transit.hub.application.dto;

import com.transit.hub.application.dto.response.LoginResponse;

import java.time.Duration;

/**
 * Internal bundle returned by {@code AuthService} when a successful
 * authentication mints both an access token and a refresh token. The
 * controller layer splits it between the JSON body (the
 * {@link LoginResponse}) and the response cookies (the raw refresh
 * token plus its TTL).
 *
 * <p>The raw refresh token never leaves this record outside of the
 * cookie header — exposing it in the JSON body would defeat the whole
 * point of an HttpOnly cookie.
 */
public record LoginBundle(
        LoginResponse loginResponse,
        String refreshTokenRaw,
        Duration refreshTokenTtl
) {}
