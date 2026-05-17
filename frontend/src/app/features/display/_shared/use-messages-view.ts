import { Signal, computed } from '@angular/core';

import { MessageInfo } from '@shared/models';

/** Info ticker — shorter base than the alert banner so brief messages
 *  don't hang on screen for a full 20s every cycle. Content length still
 *  stretches it for longer notices. */
const TICKER_BASE_SECONDS = 12;
const TICKER_FLOOR_SECONDS = 10;
const TICKER_BUMP_PER_50_CHARS = 2;

/** Critical alert — slower pace than the info ticker so passengers
 *  actually have time to read it. */
const ALERT_BASE_SECONDS = 15;
const ALERT_FLOOR_SECONDS = 12;
const ALERT_BUMP_PER_50_CHARS = 3;

export interface MessagesView {
  readonly critical: readonly MessageInfo[];
  readonly info: readonly MessageInfo[];
  /** CSS-friendly seconds for the info ticker scroll cycle. */
  readonly tickerDuration: string;
  /** CSS-friendly seconds for the critical alert scroll cycle. */
  readonly alertDuration: string;
}

/**
 * Splits a flat `MessageInfo[]` into the critical / info buckets the
 * displays consume, and computes the two scroll-cycle durations based
 * on the cumulative text length of each bucket.
 *
 * Pure — easy to unit-test without TestBed. The signal wrapper
 * {@link useMessagesView} consumes this directly.
 */
export function computeMessagesView(messages: readonly MessageInfo[]): MessagesView {
  const critical: MessageInfo[] = [];
  const info: MessageInfo[] = [];
  for (const m of messages) {
    if (m.severity === 'CRITICAL') {
      critical.push(m);
    } else {
      info.push(m);
    }
  }

  return {
    critical,
    info,
    tickerDuration: scrollSeconds(info, TICKER_BASE_SECONDS, TICKER_FLOOR_SECONDS, TICKER_BUMP_PER_50_CHARS),
    alertDuration: scrollSeconds(critical, ALERT_BASE_SECONDS, ALERT_FLOOR_SECONDS, ALERT_BUMP_PER_50_CHARS),
  };
}

function scrollSeconds(
  messages: readonly MessageInfo[],
  base: number,
  floor: number,
  bumpPer50Chars: number,
): string {
  const totalLength = messages.reduce((acc, m) => acc + m.title.length + m.content.length, 0);
  const seconds = Math.max(floor, base + Math.floor(totalLength / 50) * bumpPer50Chars);
  return `${seconds}s`;
}

/**
 * Signal-based wrapper around {@link computeMessagesView}. Tests should
 * prefer the pure function; this keeps the consumer one line long.
 */
export function useMessagesView(messages: Signal<readonly MessageInfo[]>): Signal<MessagesView> {
  return computed(() => computeMessagesView(messages()));
}
