// =============================================================================
// utils/index.ts — Shared utility helpers
// =============================================================================

// ---------------------------------------------------------------------------
// IST (Asia/Kolkata) timezone utilities
// ---------------------------------------------------------------------------

/**
 * IANA timezone identifier for Indian Standard Time.
 * IST is UTC+5:30 with no daylight-saving transitions.
 */
export const IST_TIMEZONE = "Asia/Kolkata" as const;

/**
 * The fixed UTC offset for IST in milliseconds (+5h 30m).
 * Used when Intl APIs are unavailable or for arithmetic.
 */
export const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // 19 800 000 ms

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Formats a Date as a human-readable IST string.
 *
 * Output example: "2025-10-08 13:46:09 IST"
 *
 * Uses Intl.DateTimeFormat which is available in Node ≥ 13 and all modern
 * browsers. The Date's internal UTC epoch is unchanged — only the display
 * is shifted to IST.
 */
export function formatIST(date: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  // en-CA gives "YYYY-MM-DD, HH:mm:ss" — normalise to "YYYY-MM-DD HH:mm:ss IST"
  return fmt.format(date).replace(",", "") + " IST";
}

/**
 * Returns the IST wall-clock parts of a Date as a plain object.
 * Useful for week-over-week bucketing and date arithmetic in IST.
 *
 * Example:
 *   istParts(new Date("2025-10-08T08:16:09Z"))
 *   // → { year: 2025, month: 10, day: 8, hour: 13, minute: 46, second: 9 }
 */
export function istParts(date: Date): {
  year: number;
  month: number;  // 1–12
  day: number;    // 1–31
  hour: number;   // 0–23
  minute: number;
  second: number;
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = fmt.formatToParts(date);
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

  return {
    year:   get("year"),
    month:  get("month"),
    day:    get("day"),
    hour:   get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/**
 * Returns the ISO date string (YYYY-MM-DD) for a Date in IST.
 * Safe to use for day-level bucketing and week-over-week grouping.
 *
 * Example:
 *   istDateString(new Date("2025-10-07T20:01:00Z"))
 *   // → "2025-10-08"  (because 20:01 UTC = 01:31 IST next day)
 */
export function istDateString(date: Date): string {
  const { year, month, day } = istParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Returns the ISO week number (1–53) for a Date in IST.
 * Week starts on Monday per ISO 8601.
 * Used for week-over-week activity calculations.
 */
export function istISOWeek(date: Date): { year: number; week: number } {
  // Work in IST wall-clock date to avoid UTC-day boundary issues
  const { year, month, day } = istParts(date);

  // Construct a plain Date at noon UTC for the IST calendar date
  // (noon avoids any DST edge cases even though IST has none)
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  // ISO week: Thursday of the week determines the year
  const dayOfWeek = d.getUTCDay() || 7; // Mon=1 … Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek); // shift to Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7
  );

  return { year: d.getUTCFullYear(), week };
}
