import { TranslocoService } from '@jsverse/transloco';

/**
 * Builds the localised announcement string for the next departure.
 * Pure — does not touch {@code window.speechSynthesis}, so it can be
 * unit-tested without a TestBed. {@link speak} is the side-effectful
 * sibling that actually feeds the browser synthesiser.
 *
 * Returns the noArrivals fallback string when {@code next} is missing.
 */
export function speakNextDepartureText(
  transloco: TranslocoService,
  next: {
    line: { code: string };
    destinationName: string;
    scheduledTime: string;
    realtimeDelaySeconds?: number | null;
  } | undefined,
): string {
  if (!next) {
    return transloco.translate('kiosk.speak.noArrivals');
  }
  const time = formatScheduledTime(transloco, next.scheduledTime);
  const delay = next.realtimeDelaySeconds ?? null;
  const params = { line: next.line.code, destination: next.destinationName, time };
  if (delay === null) {
    return transloco.translate('kiosk.speak.next', params);
  }
  if (delay === 0) {
    return transloco.translate('kiosk.speak.nextOnTime', params);
  }
  if (delay > 0) {
    return transloco.translate('kiosk.speak.nextDelayed', { ...params, minutes: Math.round(delay / 60) });
  }
  return transloco.translate('kiosk.speak.nextEarly', { ...params, minutes: Math.round(Math.abs(delay) / 60) });
}

/** Pretty-prints a GTFS time string (HH:mm:ss or HH:mm) for vocal
 *  output. The synthesiser handles bare digits poorly ("zero eight
 *  forty-two"); the localised template wraps them in the natural
 *  wording for the active language ("huit heures quarante-deux" /
 *  "08:42"). */
function formatScheduledTime(transloco: TranslocoService, raw: string): string {
  const trimmed = raw.length >= 5 ? raw.substring(0, 5) : raw;
  const [hh = '0', mm = '00'] = trimmed.split(':');
  return transloco.translate('kiosk.speak.time', { hh: parseInt(hh, 10), mm });
}

/** Side-effectful sibling of {@link speakNextDepartureText}: pushes
 *  the supplied text into {@code window.speechSynthesis} using the
 *  BCP-47 tag from the i18n bundle. Cancels any in-flight utterance
 *  so a rapid double-press never queues two announcements on top of
 *  each other. */
export function speak(transloco: TranslocoService, text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = transloco.translate('kiosk.speak.bcp47');
  utterance.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
