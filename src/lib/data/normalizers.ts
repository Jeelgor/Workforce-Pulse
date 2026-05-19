// =============================================================================
// normalizers.ts — Field-level canonicalization for activity logs & employees
// =============================================================================

import type {
  RawActivityLog,
  RawEmployee,
  NormalizedActivityLog,
  NormalizedEmployee,
  NormalizedCompensation,
  WorkingHours,
  WorkingHoursObject,
} from "./types";
import {
  validateDuration,
  normalizeBooleanish,
  isValidEmployeeId,
  coercePositiveNumber,
} from "./validators";

// =============================================================================
// ── ACTIVITY LOG NORMALIZERS ──────────────────────────────────────────────────
// =============================================================================

// ---------------------------------------------------------------------------
// Employee ID
// ---------------------------------------------------------------------------

/**
 * Uppercases and trims the employee_id.
 * Returns "UNKNOWN" for blank or invalid values (e.g. "?").
 */
export function normalizeEmployeeId(raw: string | undefined): string {
  if (!raw) return "UNKNOWN";
  const trimmed = raw.trim().toUpperCase();
  return isValidEmployeeId(trimmed) ? trimmed : "UNKNOWN";
}

// ---------------------------------------------------------------------------
// Department names
// ---------------------------------------------------------------------------

/**
 * Maps known department aliases to a canonical title-cased name.
 * Falls back to title-casing the raw value when no alias matches.
 */
const DEPARTMENT_MAP: Record<string, string> = {
  "hr": "HR",
  "h.r.": "HR",
  "human resources": "HR",
  "ops": "Operations",
  "operations": "Operations",
  "fin": "Finance",
  "finance": "Finance",
  "sales": "Sales",
  "mkt": "Marketing",
  "marketing": "Marketing",
  "cs": "Customer Support",
  "customer support": "Customer Support",
  "customer service": "Customer Support",
  "support": "Customer Support",
};

export function normalizeDepartment(raw: string | undefined): string {
  if (!raw) return "Unknown";
  const key = raw.trim().toLowerCase();
  return DEPARTMENT_MAP[key] ?? toTitleCase(raw.trim());
}

// ---------------------------------------------------------------------------
// App names
// ---------------------------------------------------------------------------

/**
 * Canonical app name map.
 * Keys are lowercase+trimmed versions of every variant seen in the data.
 *
 * Covers:
 *  gmail / Gmail / GMAIL / " Gmail "  → Gmail
 *  outlook / Outlook / MS Outlook     → MS Outlook
 *  excel / EXCEL / MS Excel / Microsoft Excel → MS Excel
 *  slack / SLACK                      → Slack
 *  zoom / ZOOM                        → Zoom
 *  salesforce / SFDC / Sales Force / salesforce → Salesforce
 *  zoho / Zoho CRM / zoho crm         → Zoho CRM
 *  sap / SAP                          → SAP
 *  tally / Tally ERP / tally erp      → Tally ERP
 *  chrome / Google Chrome             → Chrome
 *  powerpoint / ppt / MS PowerPoint / Microsoft PowerPoint → PowerPoint
 *  word / MS Word / Microsoft Word    → MS Word
 *  notion                             → Notion
 *  jira / JIRA                        → Jira
 *  whatsapp / whatsapp web / WhatsApp Web → WhatsApp Web
 *  - / NA / blank                     → Unknown
 */
const APP_MAP: Record<string, string> = {
  // Gmail
  "gmail": "Gmail",
  "g mail": "Gmail",
  // Outlook
  "outlook": "MS Outlook",
  "ms outlook": "MS Outlook",
  "microsoft outlook": "MS Outlook",
  // Excel
  "excel": "MS Excel",
  "ms excel": "MS Excel",
  "microsoft excel": "MS Excel",
  // Slack
  "slack": "Slack",
  // Zoom
  "zoom": "Zoom",
  // Salesforce / SFDC
  "salesforce": "Salesforce",
  "sfdc": "Salesforce",
  "sales force": "Salesforce",
  // Zoho
  "zoho": "Zoho CRM",
  "zoho crm": "Zoho CRM",
  // SAP
  "sap": "SAP",
  // Tally
  "tally": "Tally ERP",
  "tally erp": "Tally ERP",
  // Chrome
  "chrome": "Chrome",
  "google chrome": "Chrome",
  // PowerPoint
  "powerpoint": "PowerPoint",
  "ppt": "PowerPoint",
  "ms powerpoint": "PowerPoint",
  "microsoft powerpoint": "PowerPoint",
  // Word
  "word": "MS Word",
  "ms word": "MS Word",
  "microsoft word": "MS Word",
  // Notion
  "notion": "Notion",
  // Jira
  "jira": "Jira",
  // WhatsApp
  "whatsapp": "WhatsApp Web",
  "whatsapp web": "WhatsApp Web",
  "whatsapp web ": "WhatsApp Web",
  // Blanks / placeholders
  "-": "Unknown",
  "na": "Unknown",
  "n/a": "Unknown",
  "": "Unknown",
};

export function normalizeAppName(raw: string | undefined): string {
  if (!raw) return "Unknown";
  const key = raw.trim().toLowerCase();
  return APP_MAP[key] ?? toTitleCase(raw.trim());
}

// ---------------------------------------------------------------------------
// Task categories
// ---------------------------------------------------------------------------

/**
 * Canonical task category map.
 * Collapses the many spelling/casing variants found in the CSV.
 */
const TASK_MAP: Record<string, string> = {
  // Email
  "email triage": "Email Triage",
  "email-triage": "Email Triage",
  "email triag": "Email Triage",
  // Internal comms
  "internal comms": "Internal Comms",
  "internal communication": "Internal Comms",
  "internal communications": "Internal Comms",
  // Client comms
  "client comms": "Client Comms",
  "client communication": "Client Comms",
  "client communications": "Client Comms",
  // Status updates
  "status updates": "Status Updates",
  "status update": "Status Updates",
  // CRM
  "crm update": "CRM Updates",
  "crm updates": "CRM Updates",
  // Lead entry
  "lead entry": "Lead Entry",
  "lead-entry": "Lead Entry",
  // Pipeline review
  "pipeline review": "Pipeline Review",
  // Reporting
  "reporting": "Reporting",
  "reports": "Reporting",
  // Data entry
  "data entry": "Data Entry",
  "data-entry": "Data Entry",
  // Reconciliation
  "reconciliation": "Reconciliation",
  "recon": "Reconciliation",
  // Invoice processing
  "invoice proc": "Invoice Processing",
  "invoice processing": "Invoice Processing",
  // Vendor management
  "vendor mgmt": "Vendor Management",
  "vendor management": "Vendor Management",
  // Calendar management
  "cal mgmt": "Calendar Management",
  "calendar mgmt": "Calendar Management",
  "calendar management": "Calendar Management",
  // Meetings
  "meetings": "Meetings",
  "meeting": "Meetings",
  "internal meeting": "Meetings",
  // Research
  "research": "Research",
  // Vendor portals
  "vendor portals": "Vendor Portals",
  // Ticket updates
  "ticket updates": "Ticket Updates",
  // Deck building
  "deck building": "Deck Building",
  "slide building": "Deck Building",
  // Bookkeeping
  "bookkeeping": "Bookkeeping",
  // GST
  "gst prep": "GST Prep",
  "gst filing prep": "GST Prep",
  // Notes / docs
  "notes": "Notes",
  "docs": "Notes",
  "documentation": "Documentation",
  "doc drafting": "Document Drafting",
  "document drafting": "Document Drafting",
  "drafting": "Document Drafting",
  // Blanks / placeholders
  "-": "Unknown",
  "na": "Unknown",
  "n/a": "Unknown",
  "": "Unknown",
};

export function normalizeTaskCategory(raw: string | undefined): string {
  if (!raw) return "Unknown";
  const key = raw.trim().toLowerCase();
  return TASK_MAP[key] ?? toTitleCase(raw.trim());
}

// ---------------------------------------------------------------------------
// Timestamp parsing
// ---------------------------------------------------------------------------

/**
 * The IST UTC offset string appended to every naive timestamp.
 * All timestamps in the CSV are IST wall-clock times with no offset marker.
 * Appending "+05:30" anchors the Date epoch correctly regardless of the
 * server's local timezone, so Date.toISOString() will show UTC but the
 * underlying epoch is always IST-correct.
 */
const IST_OFFSET = "+05:30";

/**
 * Safely parses a timestamp string into a Date whose epoch is anchored to IST.
 *
 * Handles three formats observed in the CSV:
 *  1. ISO 8601 (no offset) : "2025-10-08T13:46:09"
 *  2. YYYY-MM-DD HH:mm     : "2025-10-08 13:46"
 *  3. DD/MM/YYYY HH:mm     : "08/10/2025 13:46"
 *
 * All three are treated as IST wall-clock times and stored with the +05:30
 * offset so the epoch is unambiguous. Returns null when blank or unparseable.
 *
 * Use formatIST() from src/lib/utils to display the value back in IST.
 * Use istDateString() / istISOWeek() for date-level bucketing.
 */
export function parseTimestamp(raw: string | undefined): Date | null {
  if (!raw || raw.trim() === "") return null;

  const s = raw.trim();

  // Format 3: DD/MM/YYYY HH:mm[:ss]  (day-first — must be matched before ISO)
  const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/;
  const m = s.match(ddmmyyyy);
  if (m) {
    const [, dd, mm, yyyy, hh, min, sec = "00"] = m;
    // Rewrite as ISO with IST offset so the epoch is timezone-correct
    const iso = `${yyyy}-${mm}-${dd}T${hh}:${min}:${sec}${IST_OFFSET}`;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Format 1 & 2: ISO or "YYYY-MM-DD HH:mm[:ss]" — no offset present
  // Replace the space separator with T, then append IST offset
  const withT = s.includes("T") ? s : s.replace(" ", "T");

  // Only append offset when none is already present (no Z, no +, no trailing -)
  const hasOffset = /[Z+]/.test(withT) || /\d-\d{2}:\d{2}$/.test(withT);
  const isoWithOffset = hasOffset ? withT : `${withT}${IST_OFFSET}`;

  const d = new Date(isoWithOffset);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Full row normalizer
// ---------------------------------------------------------------------------

/**
 * Normalises a single raw CSV row into a NormalizedActivityLog.
 *
 * Returns the normalised record plus counters for the report:
 *  - fixed: true when any field was corrected (not just casing)
 *  - dropped: true when the row should be excluded entirely
 */
export function normalizeActivityLogRow(
  raw: RawActivityLog,
  rowIndex: number
): {
  record: NormalizedActivityLog;
  fixed: boolean;
  dropped: boolean;
} {
  let fixed = false;

  const employeeId = normalizeEmployeeId(raw.employee_id);
  // A row with no valid employee ID is dropped
  const dropped = employeeId === "UNKNOWN";

  const department = normalizeDepartment(raw.department);
  const appName = normalizeAppName(raw.app_used);
  const taskCategory = normalizeTaskCategory(raw.task_category);
  const { value: durationMinutes, status: durationStatus } = validateDuration(
    raw.duration_minutes
  );
  const timestamp = parseTimestamp(raw.timestamp);
  const isRepetitive = normalizeBooleanish(raw.is_repetitive);

  // Mark as fixed when duration was invalid/flagged or timestamp was unparseable
  if (durationStatus !== "valid" || timestamp === null) {
    fixed = true;
  }

  const record: NormalizedActivityLog = {
    rowIndex,
    employeeId,
    department,
    appName,
    taskCategory,
    durationMinutes,
    durationStatus,
    timestamp,
    isRepetitive,
    _raw: raw,
  };

  return { record, fixed, dropped };
}

// =============================================================================
// ── EMPLOYEE NORMALIZERS ──────────────────────────────────────────────────────
// =============================================================================

// ---------------------------------------------------------------------------
// Compensation
// ---------------------------------------------------------------------------

/**
 * Converts any of the three compensation source fields into the two canonical
 * figures used throughout the app.
 *
 * Conversion rules (160 working hours / month assumed):
 *  annual_ctc_inr       → monthly = annual / 12,  hourly = monthly / 160
 *  salary_LPA           → annual  = LPA × 100 000, then same as above
 *  hourly_rate_inr      → hourly  = raw,           monthly = hourly × 160
 *  meta.compensation.annual → treated as annual_ctc_inr
 */
const HOURS_PER_MONTH = 160;

export function normalizeCompensation(raw: RawEmployee): NormalizedCompensation {
  // 1. annual_ctc_inr (camelCase schema)
  const annualCtc = coercePositiveNumber(raw.annual_ctc_inr);
  if (annualCtc !== null) {
    const monthly = annualCtc / 12;
    return {
      monthlyCostInr: Math.round(monthly),
      hourlyCostInr: parseFloat((monthly / HOURS_PER_MONTH).toFixed(2)),
      source: "annual_ctc_inr",
    };
  }

  // 2. salary_LPA (PascalCase schema)
  const lpa = coercePositiveNumber(raw.salary_LPA);
  if (lpa !== null) {
    const annual = lpa * 100_000;
    const monthly = annual / 12;
    return {
      monthlyCostInr: Math.round(monthly),
      hourlyCostInr: parseFloat((monthly / HOURS_PER_MONTH).toFixed(2)),
      source: "salary_LPA",
    };
  }

  // 3. hourly_rate_inr (camelCase schema)
  const hourly = coercePositiveNumber(raw.hourly_rate_inr);
  if (hourly !== null) {
    return {
      monthlyCostInr: Math.round(hourly * HOURS_PER_MONTH),
      hourlyCostInr: hourly,
      source: "hourly_rate_inr",
    };
  }

  // 4. meta.compensation.annual (E009, E010)
  const metaAnnual = coercePositiveNumber(raw.meta?.compensation?.annual);
  if (metaAnnual !== null) {
    const monthly = metaAnnual / 12;
    return {
      monthlyCostInr: Math.round(monthly),
      hourlyCostInr: parseFloat((monthly / HOURS_PER_MONTH).toFixed(2)),
      source: "meta.compensation.annual",
    };
  }

  return { monthlyCostInr: null, hourlyCostInr: null, source: "unknown" };
}

// ---------------------------------------------------------------------------
// Working hours
// ---------------------------------------------------------------------------

/**
 * Normalises working hours from any of the three shapes seen in the data:
 *
 *  - null / undefined / explicit null JSON value  → null
 *  - object: { start: "09:00", end: "18:00" }     → WorkingHours | null
 *  - string: "9-18", "9:30-18:30", "10-19"        → WorkingHours | null
 *
 * Returns null (not a stub object) when:
 *  - the raw value is absent or null
 *  - the raw value is an object but both start and end are missing/blank
 *  - the raw value is a string but cannot be split into two non-empty parts
 *  - neither extracted part produces a valid HH:mm after padding
 *
 * Only returns a WorkingHours object when at least one of start/end is
 * a meaningful "HH:mm" string.
 */
export function normalizeWorkingHours(
  raw: string | WorkingHoursObject | null | undefined
): WorkingHours | null {
  // ── Missing / explicit null ──────────────────────────────────────────────
  if (raw === null || raw === undefined) return null;

  // ── Object form: { start, end, timezone? } ───────────────────────────────
  if (typeof raw === "object") {
    const start = raw.start ? padTime(raw.start) : null;
    const end   = raw.end   ? padTime(raw.end)   : null;

    // Both parts must be absent for the whole thing to be meaningless
    if (start === null && end === null) return null;

    return { start, end, raw: JSON.stringify(raw) };
  }

  // ── String form: "9-18", "9:30-18:30", "10-19" ──────────────────────────
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  const parts = trimmed.split("-");

  // Need exactly two non-empty parts separated by "-"
  if (parts.length !== 2) return null;

  const start = parts[0].trim() ? padTime(parts[0].trim()) : null;
  const end   = parts[1].trim() ? padTime(parts[1].trim()) : null;

  // Reject if padding produced an unrecognised token (padTime returns the
  // original string unchanged when it doesn't match any known pattern)
  const startValid = start !== null && /^\d{2}:\d{2}$/.test(start);
  const endValid   = end   !== null && /^\d{2}:\d{2}$/.test(end);

  if (!startValid && !endValid) return null;

  return {
    start: startValid ? start : null,
    end:   endValid   ? end   : null,
    raw:   trimmed,
  };
}

/**
 * Pads a bare hour ("9") or "H:mm" to "HH:mm".
 */
function padTime(t: string): string {
  if (!t) return t;
  // Already "HH:mm"
  if (/^\d{2}:\d{2}$/.test(t)) return t;
  // "H:mm" → "0H:mm"
  if (/^\d:\d{2}$/.test(t)) return `0${t}`;
  // Bare hour "9" → "09:00"
  if (/^\d{1,2}$/.test(t)) return `${t.padStart(2, "0")}:00`;
  return t;
}

// ---------------------------------------------------------------------------
// Full employee normalizer
// ---------------------------------------------------------------------------

/**
 * Resolves the employee ID from either schema shape.
 */
export function resolveEmployeeId(raw: RawEmployee): string {
  const id = (raw.employee_id ?? raw.EmployeeID ?? "").trim().toUpperCase();
  return id || "UNKNOWN";
}

/**
 * Normalises a single raw employee record.
 * Handles both PascalCase (E001–E003, E007–E008, E015) and
 * camelCase (E004–E006, E009–E012, E014) schema shapes.
 */
export function normalizeEmployee(raw: RawEmployee): NormalizedEmployee {
  const employeeId = resolveEmployeeId(raw);

  // Name: camelCase → "name", PascalCase → "Name"
  const name = ((raw.name ?? raw.Name ?? "") as string).trim() || "Unknown";

  // Department: camelCase → "department", PascalCase → "Dept"
  const department = normalizeDepartment(
    (raw.department ?? raw.Dept ?? "") as string
  );

  // Role: camelCase → "role", PascalCase → "Role", or nested under meta.role
  const role = (
    (raw.role ?? raw.Role ?? raw.meta?.role ?? "") as string
  ).trim() || "Unknown";

  const compensation = normalizeCompensation(raw);

  // Working hours: camelCase → "working_hours", PascalCase → "workingHours"
  const rawWh = raw.working_hours ?? raw.workingHours ?? raw.meta?.working_hours;
  const workingHours = normalizeWorkingHours(
    rawWh as string | WorkingHoursObject | null | undefined
  );

  const status = (
    (raw.status ?? raw.Status ?? "") as string
  ).trim().toLowerCase() || "unknown";

  return {
    employeeId,
    name,
    department,
    role,
    compensation,
    workingHours,
    email: null,   // not present in current data
    location: null,
    status,
    _raw: raw,
  };
}

// =============================================================================
// ── SHARED UTILITIES ──────────────────────────────────────────────────────────
// =============================================================================

/** Converts "hello world" → "Hello World" */
export function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
