// =============================================================================
// test-normalization.ts — Temporary inspection script for the data pipeline
//
// Run with:
//   npx tsx src/lib/data/test-normalization.ts
//
// DO NOT import this file from application code.
// =============================================================================

import { loadAllData } from "./loaders";
import { formatIST, istDateString, istISOWeek } from "../../lib/utils/index";
import {
  recoverableHours,
  recoverableInr,
  automationPriorityRanking,
  employeeBenchmarks,
  weekOverWeekTrends,
  detectAnomalies,
} from "./analytics";
import type { NormalizedActivityLog, NormalizedEmployee, EnrichedActivityLog } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const DIVIDER = "─".repeat(60);

function section(title: string) {
  console.log(`\n${DIVIDER}`);
  console.log(`  ${title}`);
  console.log(DIVIDER);
}

function uniqueValues(arr: string[]): string[] {
  return [...new Set(arr)].sort();
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Load & normalise
// ─────────────────────────────────────────────────────────────────────────────

section("LOADING DATA");

const { logReport, empReport, joinReport, qualityReport } = loadAllData();

console.log("✓ Activity logs loaded");
console.log("✓ Employees loaded");
console.log("✓ Join complete");
console.log("✓ DataQualityReport built");

// ─────────────────────────────────────────────────────────────────────────────
// 3. Activity log pipeline summary
// ─────────────────────────────────────────────────────────────────────────────

section("ACTIVITY LOG PIPELINE SUMMARY");

console.table({
  "1. Total raw rows":            logReport.totalRaw,
  "2. Normalized rows":           logReport.normalized.length,
  "3. Rows dropped":              logReport.rowsDropped,
  "4. Rows fixed / corrected":    logReport.rowsFixed,
  "5. Rows flagged (zero/outlier)": logReport.rowsFlagged,
  "6. Duplicate rows removed":    logReport.duplicatesRemoved,
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Outlier breakdown
// ─────────────────────────────────────────────────────────────────────────────

section("DURATION STATUS BREAKDOWN");

const durationGroups = logReport.normalized.reduce<Record<string, number>>(
  (acc, r) => {
    acc[r.durationStatus] = (acc[r.durationStatus] ?? 0) + 1;
    return acc;
  },
  {}
);

console.table(durationGroups);

const outliers = logReport.normalized.filter((r) => r.durationStatus === "outlier");
if (outliers.length > 0) {
  console.log(`\n  Outlier rows (duration > 720 min):`);
  console.table(
    outliers.map((r) => ({
      rowIndex: r.rowIndex,
      employeeId: r.employeeId,
      appName: r.appName,
      durationMinutes: r.durationMinutes,
      timestamp_IST: r.timestamp ? formatIST(r.timestamp) : "null",
    }))
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Unique apps after normalization
// ─────────────────────────────────────────────────────────────────────────────

section("7. UNIQUE APP NAMES AFTER NORMALIZATION");

const uniqueApps = uniqueValues(logReport.normalized.map((r) => r.appName));
console.log(`  Count: ${uniqueApps.length}`);
console.table(uniqueApps.map((a) => ({ appName: a })));

// ─────────────────────────────────────────────────────────────────────────────
// 6. Unique task categories after normalization
// ─────────────────────────────────────────────────────────────────────────────

section("8. UNIQUE TASK CATEGORIES AFTER NORMALIZATION");

const uniqueTasks = uniqueValues(logReport.normalized.map((r) => r.taskCategory));
console.log(`  Count: ${uniqueTasks.length}`);
console.table(uniqueTasks.map((t) => ({ taskCategory: t })));

// ─────────────────────────────────────────────────────────────────────────────
// 7. Employee summary
// ─────────────────────────────────────────────────────────────────────────────

section("EMPLOYEE PIPELINE SUMMARY");

console.table({
  "9.  Total raw employee records":       empReport.totalRaw,
  "10. Duplicate conflicts resolved":     empReport.duplicatesResolved,
  "11. Employees missing metadata":       joinReport.missingMetadata.length,
  "12. Employees with no activity logs":  joinReport.noActivity.length,
});

if (joinReport.missingMetadata.length > 0) {
  console.log("\n  Employee IDs in logs with NO employee record:");
  console.table(joinReport.missingMetadata.map((id) => ({ employeeId: id })));
}

if (joinReport.noActivity.length > 0) {
  console.log("\n  Employee IDs with a record but ZERO activity logs:");
  console.table(joinReport.noActivity.map((id) => ({ employeeId: id })));
}

if (joinReport.duplicateConflictsResolved.length > 0) {
  console.log("\n  Duplicate conflicts resolved for:");
  console.table(
    joinReport.duplicateConflictsResolved.map((id) => ({ employeeId: id }))
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Sample records
// ─────────────────────────────────────────────────────────────────────────────

section("13. SAMPLE NORMALIZED ACTIVITY RECORD");

const sampleLog: NormalizedActivityLog | undefined = logReport.normalized.find(
  (r) => r.durationStatus === "valid" && r.timestamp !== null
);

if (sampleLog) {
  console.log({
    rowIndex:        sampleLog.rowIndex,
    employeeId:      sampleLog.employeeId,
    department:      sampleLog.department,
    appName:         sampleLog.appName,
    taskCategory:    sampleLog.taskCategory,
    durationMinutes: sampleLog.durationMinutes,
    durationStatus:  sampleLog.durationStatus,
    timestamp_IST:   sampleLog.timestamp ? formatIST(sampleLog.timestamp) : null,
    timestamp_date:  sampleLog.timestamp ? istDateString(sampleLog.timestamp) : null,
    timestamp_week:  sampleLog.timestamp ? istISOWeek(sampleLog.timestamp) : null,
    isRepetitive:    sampleLog.isRepetitive,
  });
} else {
  console.log("  (no valid sample found)");
}

// ─────────────────────────────────────────────────────────────────────────────

section("14. SAMPLE NORMALIZED EMPLOYEE RECORD");

const sampleEmp: NormalizedEmployee | undefined = empReport.normalized[0];

if (sampleEmp) {
  console.log({
    employeeId:   sampleEmp.employeeId,
    name:         sampleEmp.name,
    department:   sampleEmp.department,
    role:         sampleEmp.role,
    status:       sampleEmp.status,
    compensation: sampleEmp.compensation,
    workingHours: sampleEmp.workingHours,   // null or { start, end, raw }
    hasDuplicateConflict: sampleEmp.duplicateConflict !== undefined,
  });
} else {
  console.log("  (no employee records found)");
}

// ─────────────────────────────────────────────────────────────────────────────
// Working-hours breakdown across all employees
// ─────────────────────────────────────────────────────────────────────────────

section("WORKING HOURS BREAKDOWN (all employees)");

console.table(
  empReport.normalized.map((e) => ({
    employeeId: e.employeeId,
    start:      e.workingHours?.start ?? "(null)",
    end:        e.workingHours?.end   ?? "(null)",
    raw:        e.workingHours?.raw   ?? "(null — no data)",
  }))
);

// ─────────────────────────────────────────────────────────────────────────────

section("15. SAMPLE JOINED (ENRICHED) RECORD");

const sampleJoined: EnrichedActivityLog | undefined = joinReport.enriched.find(
  (r) => r.employee !== null && r.durationStatus === "valid"
);

if (sampleJoined) {
  console.log({
    // Activity fields
    rowIndex:        sampleJoined.rowIndex,
    employeeId:      sampleJoined.employeeId,
    department:      sampleJoined.department,
    appName:         sampleJoined.appName,
    taskCategory:    sampleJoined.taskCategory,
    durationMinutes: sampleJoined.durationMinutes,
    timestamp_IST:   sampleJoined.timestamp ? formatIST(sampleJoined.timestamp) : null,
    timestamp_date:  sampleJoined.timestamp ? istDateString(sampleJoined.timestamp) : null,
    // Employee fields
    employeeName:    sampleJoined.employee?.name,
    employeeRole:    sampleJoined.employee?.role,
    monthlyCostInr:  sampleJoined.employee?.compensation.monthlyCostInr,
    hourlyCostInr:   sampleJoined.employee?.compensation.hourlyCostInr,
    compensationSrc: sampleJoined.employee?.compensation.source,
    workingHours:    sampleJoined.employee?.workingHours,
  });
} else {
  console.log("  (no enriched record with employee metadata found)");
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. IST timezone verification — spot-check a few known timestamps
// ─────────────────────────────────────────────────────────────────────────────

section("IST TIMEZONE VERIFICATION");

console.log("  Spot-checking that naive CSV timestamps are anchored to IST:");
console.log("  (raw CSV value → stored epoch → formatted back in IST)\n");

const spot = logReport.normalized
  .filter((r) => r.timestamp !== null)
  .slice(0, 6);

console.table(
  spot.map((r) => ({
    raw_csv:        r._raw.timestamp ?? "",
    epoch_utc:      r.timestamp!.toISOString(),
    formatted_IST:  formatIST(r.timestamp!),
    date_IST:       istDateString(r.timestamp!),
    week_IST:       `${istISOWeek(r.timestamp!).year}-W${String(istISOWeek(r.timestamp!).week).padStart(2, "0")}`,
  }))
);

// ─────────────────────────────────────────────────────────────────────────────
// 10. Centralized DataQualityReport
// ─────────────────────────────────────────────────────────────────────────────
section("DATA QUALITY REPORT (centralized)");

// ── Activity log ingestion ──
console.log("  Activity log ingestion:\n");
console.table({
  "totalRawRows":         qualityReport.totalRawRows,
  "normalizedRows":       qualityReport.normalizedRows,
  "droppedRows":          qualityReport.droppedRows,
  "fixedRows":            qualityReport.fixedRows,
  "flaggedRows":          qualityReport.flaggedRows,
  "duplicateRowsRemoved": qualityReport.duplicateRowsRemoved,
  "invalidRows":          qualityReport.invalidRows,
  "outlierRows":          qualityReport.outlierRows,
});

// ── Employee data quality ──
console.log("\n  Employee data quality:\n");
console.table({
  "duplicateEmployeeConflicts":   qualityReport.duplicateEmployeeConflicts,
  "employeesMissingMetadataCount": qualityReport.employeesMissingMetadataCount,
  "metadataWithoutActivityCount":  qualityReport.metadataWithoutActivityCount,
});

// ── Join quality detail ──
if (qualityReport.employeesMissingMetadata.length > 0) {
  console.log("\n  employeesMissingMetadata (in logs, no employee record):");
  console.table(qualityReport.employeesMissingMetadata.map((id) => ({ employeeId: id })));
}

if (qualityReport.metadataWithoutActivity.length > 0) {
  console.log("\n  metadataWithoutActivity (employee record, zero logs):");
  console.table(qualityReport.metadataWithoutActivity.map((id) => ({ employeeId: id })));
}

// ── Full report as JSON (for AI context / export reference) ──
console.log("\n  Full report (JSON-serialisable):\n");
console.log(JSON.stringify(qualityReport, null, 2));

// ─────────────────────────────────────────────────────────────────────────────
// 11. Analytics engine output
// ─────────────────────────────────────────────────────────────────────────────

section("RECOVERABLE HOURS");
const rh = recoverableHours(logReport.normalized);
console.table({
  totalRepetitiveMinutes:       rh.totalRepetitiveMinutes,
  totalRecoverableMinutes:      rh.totalRecoverableMinutes,
  totalRecoverableHours:        rh.totalRecoverableHours,
  outlierRowsExcluded:          rh.metadata.outlierRowsTracked,
  rowsExcludedInvalidDuration:  rh.metadata.rowsExcludedInvalidDuration,
  rowsExcludedNonRepetitive:    rh.metadata.rowsExcludedNonRepetitive,
  outliersIncluded:             rh.metadata.outliersIncluded,
});
console.log("\n  By department:");
console.table(rh.byDepartment.map(d => ({
  department: d.department,
  repetitiveMin: d.repetitiveMinutes,
  recoverableMin: d.recoverableMinutes,
  rows: d.contributingRows.length,
})));
console.log("\n  By task category (top 8):");
console.table(rh.byTaskCategory.slice(0, 8).map(t => ({
  taskCategory: t.taskCategory,
  feasibility: t.automationFeasibility,
  repetitiveMin: t.repetitiveMinutes,
  recoverableMin: t.recoverableMinutes,
})));

section("RECOVERABLE INR");
const ri = recoverableInr(joinReport.enriched);
console.table({
  totalRecoverableInr:              ri.totalRecoverableInr,
  rowsSkippedNoCompensation:        ri.metadata.rowsSkippedNoCompensation,
  rowsExcludedInvalidDuration:      ri.metadata.rowsExcludedInvalidDuration,
  rowsExcludedNonRepetitive:        ri.metadata.rowsExcludedNonRepetitive,
  outlierRowsTracked:               ri.metadata.outlierRowsTracked,
});
console.log("\n  By department:");
console.table(ri.byDepartment.map(d => ({
  department: d.department,
  recoverableInr: d.recoverableInr,
  employees: d.contributingEmployeeIds.length,
})));
console.log("\n  By task category (top 8):");
console.table(ri.byTaskCategory.slice(0, 8).map(t => ({
  taskCategory: t.taskCategory,
  recoverableInr: t.recoverableInr,
  employees: t.contributingEmployeeIds.length,
})));

section("AUTOMATION PRIORITY RANKING");
const ranking = automationPriorityRanking(joinReport.enriched);
console.table(ranking.map(r => ({
  rank: ranking.indexOf(r) + 1,
  taskCategory: r.taskCategory,
  score: r.score,
  feasibility: r.automationFeasibility,
  repMin: r.repetitiveMinutes,
  inrImpact: r.estimatedInrImpact,
  employees: r.employeeCount,
})));

section("EMPLOYEE BENCHMARKS (top 10 by repetitive%)");
const benchmarks = employeeBenchmarks(joinReport.enriched);
console.table(benchmarks.slice(0, 10).map(b => ({
  employeeId:      b.employeeId,
  role:            b.role,
  repPct:          b.repetitivePercent,
  roleAvgPct:      b.peerComparison.roleAvgRepetitivePercent,
  delta:           b.peerComparison.deltaFromRoleAvg,
  repCostInr:      b.estimatedRepetitiveCostInr,
  topTask:         b.topRepetitiveTasks[0]?.taskCategory ?? "—",
})));

section("WEEK-OVER-WEEK TRENDS");
const wow = weekOverWeekTrends(logReport.normalized);
console.log("  Repetitive workload % by week:");
console.table(wow.repetitiveWorkload.map(w => ({
  week: w.week,
  totalMin: w.totalMinutes,
  repMin: w.repetitiveMinutes,
  repPct: w.repetitivePercent,
  sessions: w.sessionCount,
})));

if (wow.insights) {
  console.log("\n  WoW Insights:");
  const ins = wow.insights;
  if (ins.largestRepetitiveIncrease) {
    console.log(`  ↑ Largest increase: ${ins.largestRepetitiveIncrease.fromWeek} → ${ins.largestRepetitiveIncrease.toWeek} (+${ins.largestRepetitiveIncrease.deltaPercent} pp)`);
  }
  if (ins.largestRepetitiveDecrease) {
    console.log(`  ↓ Largest decrease: ${ins.largestRepetitiveDecrease.fromWeek} → ${ins.largestRepetitiveDecrease.toWeek} (${ins.largestRepetitiveDecrease.deltaPercent} pp)`);
  }
  if (ins.fastestGrowingTask) {
    console.log(`  📈 Fastest-growing task: "${ins.fastestGrowingTask.taskCategory}" ${ins.fastestGrowingTask.fromWeek} → ${ins.fastestGrowingTask.toWeek} (+${ins.fastestGrowingTask.deltaMinutes} min)`);
  }
  if (ins.biggestDeptShift) {
    const s = ins.biggestDeptShift;
    console.log(`  🏢 Biggest dept shift: ${s.department} ${s.fromWeek} → ${s.toWeek} (${s.direction === "increase" ? "+" : "-"}${s.deltaMinutes} min)`);
  }
}

section("ANOMALY DETECTION");
const anomalies = detectAnomalies(joinReport.enriched);
console.log(`  ${anomalies.length} anomalies detected:\n`);
for (const a of anomalies) {
  console.log(`  [${a.severity.toUpperCase()}] ${a.title}`);
  console.log(`  ${a.explanation}`);
  console.log(`  Metrics:`, a.supportingMetrics);
  console.log(`  Employees: ${a.employeeIds.join(", ")}`);
  console.log(`  Rows: ${a.rowIndices.length} contributing rows\n`);
}

// ─────────────────────────────────────────────────────────────────────────────

section("DONE");
console.log("  Pipeline inspection complete.\n");
