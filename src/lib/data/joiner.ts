// =============================================================================
// joiner.ts — Join normalised activity logs with normalised employee records
// =============================================================================

import type {
  NormalizedActivityLog,
  NormalizedEmployee,
  EnrichedActivityLog,
  JoinReport,
} from "./types";

/**
 * Joins activity logs with employee metadata by employeeId.
 *
 * Tracks:
 *  - missingMetadata  : employee IDs in logs that have no employee record
 *  - noActivity       : employee IDs with a record but zero matching logs
 *  - duplicateConflictsResolved : IDs where the employee record had a duplicate
 *
 * @param logs      Normalised activity log rows (from loadActivityLogs)
 * @param employees Normalised employee records (from loadEmployees)
 */
export function joinLogsWithEmployees(
  logs: NormalizedActivityLog[],
  employees: NormalizedEmployee[]
): JoinReport {
  // Build a lookup map: employeeId → NormalizedEmployee
  const employeeMap = new Map<string, NormalizedEmployee>();
  for (const emp of employees) {
    employeeMap.set(emp.employeeId, emp);
  }

  // Track which employee IDs actually appear in the logs
  const seenInLogs = new Set<string>();

  const enriched: EnrichedActivityLog[] = logs.map((log) => {
    seenInLogs.add(log.employeeId);
    const employee = employeeMap.get(log.employeeId) ?? null;
    return { ...log, employee };
  });

  // Employees in logs with no matching record
  const missingMetadata = [...seenInLogs].filter(
    (id) => !employeeMap.has(id) && id !== "UNKNOWN"
  );

  // Employees with a record but no activity logs
  const noActivity = employees
    .map((e) => e.employeeId)
    .filter((id) => !seenInLogs.has(id));

  // Employees where a duplicate conflict was resolved
  const duplicateConflictsResolved = employees
    .filter((e) => e.duplicateConflict !== undefined)
    .map((e) => e.employeeId);

  return {
    totalLogs: logs.length,
    enriched,
    missingMetadata,
    noActivity,
    duplicateConflictsResolved,
  };
}
