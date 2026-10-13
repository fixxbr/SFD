/**
 * Central place for external booking / form links.
 * Every CTA across the site reads from here.
 */
export const links = {
  // Google Calendar appointment scheduling link (admin@afterstem.ai)
  calendar: 'https://calendar.app.google/yhpKhbuVNoGHsjFa6',
  // Free assessment uses the same booking flow until a separate form exists.
  form: 'https://calendar.app.google/yhpKhbuVNoGHsjFa6',
}

/** Whether a link has been configured yet (not a placeholder). */
export function isConfigured(url: string) {
  return url !== '#' && url.trim().length > 0
}
