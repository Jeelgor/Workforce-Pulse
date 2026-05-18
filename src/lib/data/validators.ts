// =============================================================================
// validators.ts — Pure validation helpers for the Workforce Pulse data layer
// =============================================================================

import type { DurationStatus } from "./types";

// ---------------------------------------------------------------------------
// Duration validation
// ---------------------------------------------------------------------------

/**
 * Validates a raw duration string from the CSV.
 *
 * Rules:
 *  - blank / non-numeric          → "invalid"  (value: null)
 *  - negative                     → "invalid"  (value: null)
 *  - exactly 0                    → "flagged_zero" (value: 0)
 *  - > 720 minutes (12 h)         → "outlier"  (value kept)
 *  - otherwise                    → "valid"
 */
export function validateDuration(raw: string | undefined): {
  value: number | null;
  status: DurationStatus;
} {
  if (raw === undefined || raw.trim() === "") {
    return { value: null, status: "invalid" };
  }

  const n = Number(raw.trim());

  if (!Number.isFinite(n)) {
    return { value: null, status: "invalid" };
  }

  if (n < 0) {
    return { value: null, status: "invalid" };
  }

  if (n === 0) {
    return { value: 0, status: "flagged_zero" };
  }

  if (n > 720) {
    return { value: n, status: "outlier" };
  }

  return { value: n, status: "valid" };
}

// ---------------------------------------------------------------------------
// Boolean-ish normalisation
// ---------------------------------------------------------------------------

/**
 * Normalises the many truthy representations found in the CSV.
 *
 * Truthy  → true  : "TRUE", "true", "1", "yes", "Yes", "YES"
 * Anything else   → false  (including "0", "no", "false", "-", blank)
 */
export function normalizeBooleanish(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  const v = raw.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

// ---------------------------------------------------------------------------
// Employee-ID validation
// ---------------------------------------------------------------------------

/**
 * Returns true for a valid employee ID (E followed by digits, e.g. "E007").
 * Rejects "?", blank, or anything that doesn't match the pattern.
 */
export function isValidEmployeeId(raw: string | undefined): boolean {
  if (!raw) return false;
  return /^E\d+$/i.test(raw.trim());
}

// ---------------------------------------------------------------------------
// Compensation validation
// ---------------------------------------------------------------------------

/**
 * Coerces a raw compensation value (number or string) to a positive number.
 * Returns null when the value is missing, zero, or non-numeric.
 */
export function coercePositiveNumber(
  raw: number | string | undefined | null
): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
