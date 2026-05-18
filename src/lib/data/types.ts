// =============================================================================
// types.ts — Shared TypeScript types for the Workforce Pulse data layer
// =============================================================================

// ---------------------------------------------------------------------------
// Raw shapes — exactly what comes off disk
// ---------------------------------------------------------------------------

/**
 * One raw row from activity_logs.csv.
 * All values are strings because CSV parsers yield strings.
 * Column name is "app_used" in the real file (not "app_name").
 */
export interface RawActivityLog {
  employee_id?: string;
  department?: string;
  timestamp?: string;
  app_used?: string;
  task_category?: string;
  duration_minutes?: string;
  /** The real boolean-ish column in the CSV */
  is_repetitive?: string;
  // Allow extra columns without breaking the type
  [key: string]: string | undefined;
}

/**
 * One raw record from employees.json.
 * The HRMS export has two schema shapes (PascalCase vs camelCase)
 * and some records nest compensation/role under `meta`.
 */
export interface RawEmployee {
  // ── camelCase schema (E004–E006, E009–E012, E014) ──
  employee_id?: string;
  name?: string;
  department?: string;
  role?: string;
  annual_ctc_inr?: number | string;
  hourly_rate_inr?: number | string;
  working_hours?: string | WorkingHoursObject | null;
  tenure_months?: number;
  status?: string;
  terminated_on?: string;
  /** E009 / E010 nest role + compensation here */
  meta?: {
    role?: string;
    compensation?: { currency?: string; annual?: number | string };
    tenure_months?: number;
    working_hours?: string | WorkingHoursObject | null;
    [key: string]: unknown;
  };

  // ── PascalCase schema (E001–E003, E007–E008, E015) ──
  EmployeeID?: string;
  Name?: string;
  Dept?: string;
  Role?: string;
  salary_LPA?: number | string;
  tenureMonths?: number;
  workingHours?: string | WorkingHoursObject | null;
  Status?: string;

  [key: string]: unknown;
}

/** Object form of working hours as seen in the JSON */
export interface WorkingHoursObject {
  start?: string;
  end?: string;
  timezone?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Normalised shapes — what the rest of the app consumes
// ---------------------------------------------------------------------------

/** Outcome of duration validation */
export type DurationStatus =
  | "valid"       // positive, ≤ 720
  | "invalid"     // blank, non-numeric, or negative
  | "flagged_zero"// exactly 0
  | "outlier";    // > 720 minutes (12 hours)

/** A fully normalised activity-log row */
export interface NormalizedActivityLog {
  /** Synthetic 1-based row index (CSV has no id column) */
  rowIndex: number;
  employeeId: string;        // uppercased, trimmed; "UNKNOWN" when blank/"?"
  department: string;        // title-cased canonical name
  appName: string;           // canonical app name e.g. "Gmail", "MS Outlook"
  taskCategory: string;      // canonical task category
  durationMinutes: number | null; // null when invalid
  durationStatus: DurationStatus;
  timestamp: Date | null;    // null when unparseable
  /** Normalised from is_repetitive column (TRUE/true/1/yes → true) */
  isRepetitive: boolean;
  _raw: RawActivityLog;
}

/** Normalised compensation expressed in two canonical units */
export interface NormalizedCompensation {
  monthlyCostInr: number | null;
  hourlyCostInr: number | null;
  /** Which source field was used to derive the figures */
  source: "annual_ctc_inr" | "hourly_rate_inr" | "salary_LPA" | "meta.compensation.annual" | "unknown";
}

/**
 * Parsed working-hours window.
 * Only present when at least one of start/end could be extracted.
 * Consumers must check for null before using this field.
 */
export interface WorkingHours {
  start: string | null; // "09:00" — null when only end was parseable
  end: string | null;   // "18:00" — null when only start was parseable
  /** Original raw value stringified for audit */
  raw: string;
}

/** A fully normalised employee record */
export interface NormalizedEmployee {
  employeeId: string;
  name: string;
  department: string;
  role: string;
  compensation: NormalizedCompensation;
  /**
   * null when the raw record had no working-hours data, or when the data
   * was present but could not yield at least one valid HH:mm value.
   */
  workingHours: WorkingHours | null;
  email: string | null;
  location: string | null;
  status: string;
  /** Present when two raw records shared the same employeeId */
  duplicateConflict?: {
    kept: RawEmployee;
    discarded: RawEmployee[];
  };
  _raw: RawEmployee;
}

// ---------------------------------------------------------------------------
// Joined / enriched shape
// ---------------------------------------------------------------------------

/** Activity log enriched with employee metadata */
export interface EnrichedActivityLog extends NormalizedActivityLog {
  /** null when no matching employee record exists */
  employee: NormalizedEmployee | null;
}

// ---------------------------------------------------------------------------
// Processing reports
// ---------------------------------------------------------------------------

export interface ActivityLogReport {
  totalRaw: number;
  rowsDropped: number;   // invalid employee_id, unparseable timestamp, etc.
  rowsFixed: number;     // values that were normalised/corrected
  rowsFlagged: number;   // zero-duration or outlier rows kept but flagged
  duplicatesRemoved: number;
  normalized: NormalizedActivityLog[];
}

export interface EmployeeReport {
  totalRaw: number;
  duplicatesResolved: number;
  normalized: NormalizedEmployee[];
}

export interface JoinReport {
  totalLogs: number;
  enriched: EnrichedActivityLog[];
  /** Employee IDs in logs that have no employee record */
  missingMetadata: string[];
  /** Employee IDs with a record but zero activity logs */
  noActivity: string[];
  /** Employee IDs where duplicate conflicts were resolved */
  duplicateConflictsResolved: string[];
}

// ---------------------------------------------------------------------------
// Centralized data quality report
// ---------------------------------------------------------------------------

/**
 * DataQualityReport — single source of truth for all normalization and
 * join-quality metrics across the full pipeline.
 *
 * Assembled by buildDataQualityReport() in analytics.ts from the three
 * sub-reports produced by loadActivityLogs(), loadEmployees(), and
 * joinLogsWithEmployees().
 *
 * Intended consumers:
 *  - Dashboard quality panel
 *  - AI assistant context builder
 *  - CSV / PDF exports
 *  - Methodology documentation
 */
export interface DataQualityReport {
  // ── Activity log ingestion ───────────────────────────────────────────────

  /** Total rows parsed from activity_logs.csv before any filtering */
  totalRawRows: number;

  /** Rows that passed normalization and are available for analysis */
  normalizedRows: number;

  /**
   * Rows removed entirely — invalid employee_id (blank, "?") or
   * any other condition that makes the row unanalysable
   */
  droppedRows: number;

  /**
   * Rows where at least one field was corrected during normalization
   * (e.g. unparseable timestamp, invalid duration coerced to null)
   */
  fixedRows: number;

  /**
   * Rows kept but carrying a quality flag:
   * durationStatus === "flagged_zero" or "outlier"
   */
  flaggedRows: number;

  /** Exact-duplicate activity rows removed (same employee + time + app + duration) */
  duplicateRowsRemoved: number;

  /** Rows with durationStatus === "invalid" (blank, negative, non-numeric) */
  invalidRows: number;

  /** Rows with durationStatus === "outlier" (duration > 720 minutes) */
  outlierRows: number;

  // ── Employee data quality ────────────────────────────────────────────────

  /**
   * Number of employee IDs that appeared in more than one raw record
   * and required conflict resolution (kept the record with more fields)
   */
  duplicateEmployeeConflicts: number;

  // ── Join quality ─────────────────────────────────────────────────────────

  /**
   * Employee IDs that appear in activity logs but have no matching
   * record in employees.json — their logs are enriched with employee: null
   */
  employeesMissingMetadata: string[];

  /**
   * Employee IDs that have a record in employees.json but produced
   * zero matching activity log rows after normalization
   */
  metadataWithoutActivity: string[];

  // ── Derived convenience counts ───────────────────────────────────────────

  /** employeesMissingMetadata.length — for quick numeric access */
  employeesMissingMetadataCount: number;

  /** metadataWithoutActivity.length — for quick numeric access */
  metadataWithoutActivityCount: number;

  /** ISO 8601 timestamp (UTC) when this report was generated */
  generatedAt: string;
}
