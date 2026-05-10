/**
 * Locale-aware date formatting with cached Intl.DateTimeFormat instances.
 * Cache key is `${locale}|${optionsKey}` where the options object is
 * serialised. Avoids re-creating the formatter on every render — kiosks
 * update at 1 Hz so the saving is real.
 */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(locale: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = locale + '|' + JSON.stringify(opts);
  let fmt = formatterCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, opts);
    formatterCache.set(key, fmt);
  }
  return fmt;
}

/** Map an app locale code ('fr' / 'en') to a BCP-47 tag. */
export function bcp47(locale: string): string {
  if (locale === 'fr') { return 'fr-FR'; }
  if (locale === 'en') { return 'en-US'; }
  return locale;
}

/** Format a Date with the locale + options, reusing cached formatters. */
export function formatLocaleDate(
  date: Date,
  locale: string,
  opts: Intl.DateTimeFormatOptions,
): string {
  return getFormatter(bcp47(locale), opts).format(date);
}
