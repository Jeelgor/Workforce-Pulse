// =============================================================================
// loaders.ts — Read raw data from disk and parse into typed structures
// =============================================================================
//
// These functions run server-side only (Node.js / Next.js Server Components /
// Route Handlers). They are intentionally kept free of any UI concerns.
// =============================================================================

import fs from "fs";
import path from "path";
import type { RawActivityLog, RawEmployee, ActivityLogReport, EmployeeReport, DataQualityReport } from "./types";
import { normalizeActivityLogRow, normalizeEmployee, resolveEmployeeId } from "./normalizers";
import { joinLogsWithEmployees } from "./joiner";
import { buildDataQualityReport } from "./analytics";

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/** Resolves a path relative to the project root (process.cwd()) */
function dataPath(filename: string): string {
  return path.join(process.cwd(), "src", "data", filename);
}

// ---------------------------------------------------------------------------
// CSV parser
// ---------------------------------------------------------------------------

/**
 * Minimal, dependency-free CSV parser.
 *
 * Handles:
 *  - quoted fields (including fields with embedded commas)
 *  - CRLF and LF line endings
 *  - trailing empty lines
 *
 * Returns an array of objects keyed by the header row.
 */
export function parseCsv(raw: string): Record<string, string>[] {
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  // Filter out completely empty lines
  const nonEmpty = lines.filter((l) => l.trim() !== "");
  if (nonEmpty.length < 2) return [];

  const headers = splitCsvLine(nonEmpty[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < nonEmpty.length; i++) {
    const values = splitCsvLine(nonEmpty[i]);
    // Skip rows that are shorter than the header (e.g. trailing partial lines)
    if (values.every((v) => v === "")) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] ?? "").trim();
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Splits a single CSV line respecting double-quoted fields.
 */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // Escaped quote inside a quoted field
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ---------------------------------------------------------------------------
// Activity logs loader
// ---------------------------------------------------------------------------

/**
 * Reads activity_logs.csv, parses it, and returns a fully processed
 * ActivityLogReport with normalised rows and quality counters.
 *
 * Deduplication: rows with identical (employeeId + timestamp ISO string +
 * appName + durationMinutes) are considered duplicates; only the first is kept.
 */
export function loadActivityLogs(): ActivityLogReport {
  const filePath = dataPath("activity_logs.csv");
  const raw = fs.readFileSync(filePath, "utf-8");
  const rows = parseCsv(raw) as RawActivityLog[];

  let rowsDropped = 0;
  let rowsFixed = 0;
  let rowsFlagged = 0;
  let duplicatesRemoved = 0;

  const seen = new Set<string>();
  const normalized = [];

  for (let i = 0; i < rows.length; i++) {
    const { record, fixed, dropped } = normalizeActivityLogRow(rows[i], i + 1);

    if (dropped) {
      rowsDropped++;
      continue;
    }

    // Deduplication key: employee + timestamp + app + duration
    const dedupKey = [
      record.employeeId,
      record.timestamp?.toISOString() ?? record._raw.timestamp ?? "",
      record.appName,
      String(record.durationMinutes),
    ].join("|");

    if (seen.has(dedupKey)) {
      duplicatesRemoved++;
      continue;
    }
    seen.add(dedupKey);

    if (fixed) rowsFixed++;
    if (record.durationStatus === "flagged_zero" || record.durationStatus === "outlier") {
      rowsFlagged++;
    }

    normalized.push(record);
  }

  return {
    totalRaw: rows.length,
    rowsDropped,
    rowsFixed,
    rowsFlagged,
    duplicatesRemoved,
    normalized,
  };
}

// ---------------------------------------------------------------------------
// Employees loader
// ---------------------------------------------------------------------------

/**
 * Reads employees.json, normalises each record, and resolves duplicates.
 *
 * Duplicate resolution strategy:
 *  - When two records share the same employeeId, the one with more fields
 *    (higher key count) is kept as the primary record.
 *  - The discarded record(s) are preserved in `duplicateConflict.discarded`
 *    for audit purposes.
 */
export function loadEmployees(): EmployeeReport {
  const filePath = dataPath("employees.json");
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  // The JSON wraps the array under an "employees" key
  const rawList: RawEmployee[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw.employees)
    ? raw.employees
    : [];

  // Group by resolved employee ID
  const grouped = new Map<string, RawEmployee[]>();
  for (const emp of rawList) {
    const id = resolveEmployeeId(emp);
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id)!.push(emp);
  }

  let duplicatesResolved = 0;
  const normalized = [];

  for (const [, records] of grouped) {
    if (records.length === 1) {
      normalized.push(normalizeEmployee(records[0]));
      continue;
    }

    // Multiple records for the same ID — pick the one with the most keys
    duplicatesResolved++;
    const sorted = [...records].sort(
      (a, b) => Object.keys(b).length - Object.keys(a).length
    );
    const primary = sorted[0];
    const discarded = sorted.slice(1);

    const normalised = normalizeEmployee(primary);
    normalised.duplicateConflict = { kept: primary, discarded };
    normalized.push(normalised);
  }

  return {
    totalRaw: rawList.length,
    duplicatesResolved,
    normalized,
  };
}

// ---------------------------------------------------------------------------
// Full pipeline — single entry point
// ---------------------------------------------------------------------------

/**
 * Runs the complete data pipeline in one call:
 *   1. Load + normalise activity_logs.csv
 *   2. Load + normalise employees.json
 *   3. Join logs with employee metadata
 *   4. Build the centralized DataQualityReport
 *
 * Use this in Server Components, Route Handlers, and the AI context builder
 * instead of calling the three loaders individually.
 */
export function loadAllData(): {
  logReport:    ActivityLogReport;
  empReport:    EmployeeReport;
  joinReport:   ReturnType<typeof joinLogsWithEmployees>;
  qualityReport: DataQualityReport;
} {
  const logReport  = loadActivityLogs();
  const empReport  = loadEmployees();
  const joinReport = joinLogsWithEmployees(logReport.normalized, empReport.normalized);
  const qualityReport = buildDataQualityReport(logReport, empReport, joinReport);

  return { logReport, empReport, joinReport, qualityReport };
}
