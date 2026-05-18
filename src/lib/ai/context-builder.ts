// =============================================================================
// context-builder.ts
// Assembles a structured, grounded analytics context from the pipeline outputs.
// The context is injected into the system prompt so the LLM answers from real
// data — never from hallucinated numbers.
// =============================================================================

import type {
  RecoverableHoursResult,
  RecoverableInrResult,
  AutomationPriorityItem,
  EmployeeBenchmark,
  WeekOverWeekResult,
  Anomaly,
} from "../data/analytics";
import type { DataQualityReport } from "../data/types";

export interface AnalyticsContext {
  recoverable: RecoverableHoursResult;
  recoverableInr: RecoverableInrResult;
  automationPriority: AutomationPriorityItem[];
  employeeBenchmarks: EmployeeBenchmark[];
  weekOverWeek: WeekOverWeekResult;
  anomalies: Anomaly[];
  qualityReport: DataQualityReport;
}

/**
 * Builds a compact, human-readable analytics summary string.
 *
 * Rules:
 *  - Numbers are rounded to 1–2 significant figures for readability
 *  - Lists are capped at 5 items to keep the context token-efficient
 *  - No raw row data is included — only aggregated metrics
 *  - Each section is clearly labelled so the LLM can cite it
 */
export function buildAnalyticsContext(ctx: AnalyticsContext): string {
  const lines: string[] = [];

  // ── 1. Recoverable hours ─────────────────────────────────────────────────
  lines.push("=== RECOVERABLE HOURS ===");
  lines.push(
    `Total repetitive minutes: ${ctx.recoverable.totalRepetitiveMinutes}`
  );
  lines.push(
    `Total recoverable hours (after automation feasibility): ${ctx.recoverable.totalRecoverableHours}`
  );
  lines.push("By department (top 5):");
  ctx.recoverable.byDepartment.slice(0, 5).forEach((d) => {
    lines.push(
      `  ${d.department}: ${d.recoverableMinutes} recoverable min (${d.repetitiveMinutes} repetitive min)`
    );
  });
  lines.push("By task category (top 5):");
  ctx.recoverable.byTaskCategory.slice(0, 5).forEach((t) => {
    lines.push(
      `  ${t.taskCategory}: ${t.recoverableMinutes} min (feasibility ${t.automationFeasibility})`
    );
  });

  // ── 2. Recoverable INR ───────────────────────────────────────────────────
  lines.push("\n=== RECOVERABLE INR (monthly estimate) ===");
  lines.push(
    `Total recoverable INR: ₹${ctx.recoverableInr.totalRecoverableInr.toLocaleString()}`
  );
  lines.push(
    `Rows skipped (no compensation data): ${ctx.recoverableInr.metadata.rowsSkippedNoCompensation}`
  );
  lines.push("By department (top 5):");
  ctx.recoverableInr.byDepartment.slice(0, 5).forEach((d) => {
    lines.push(
      `  ${d.department}: ₹${d.recoverableInr.toLocaleString()} (${d.contributingEmployeeIds.length} employees)`
    );
  });
  lines.push("By task category (top 5):");
  ctx.recoverableInr.byTaskCategory.slice(0, 5).forEach((t) => {
    lines.push(
      `  ${t.taskCategory}: ₹${t.recoverableInr.toLocaleString()} (${t.contributingEmployeeIds.length} employees)`
    );
  });

  // ── 3. Automation priority ranking ───────────────────────────────────────
  lines.push("\n=== AUTOMATION PRIORITY RANKING (top 10) ===");
  ctx.automationPriority.slice(0, 10).forEach((item, i) => {
    lines.push(
      `  ${i + 1}. ${item.taskCategory} — score ${item.score}/100, ` +
        `feasibility ${item.automationFeasibility}, ` +
        `INR impact ₹${item.estimatedInrImpact.toLocaleString()}, ` +
        `${item.employeeCount} employees`
    );
  });

  // ── 4. Employee benchmarks ───────────────────────────────────────────────
  lines.push("\n=== EMPLOYEE BENCHMARKS (top 10 by repetitive%) ===");
  ctx.employeeBenchmarks.slice(0, 10).forEach((b) => {
    const delta = b.peerComparison.deltaFromRoleAvg;
    const deltaStr =
      delta > 0 ? `+${delta} pp above` : delta < 0 ? `${delta} pp below` : "at";
    lines.push(
      `  ${b.name} (${b.role}, ${b.department}): ` +
        `${b.repetitivePercent}% repetitive, ` +
        `${deltaStr} role avg (${b.peerComparison.roleAvgRepetitivePercent}%), ` +
        `est. cost ₹${b.estimatedRepetitiveCostInr.toLocaleString()}`
    );
    if (b.topRepetitiveTasks.length > 0) {
      lines.push(
        `    Top tasks: ${b.topRepetitiveTasks
          .map((t) => `${t.taskCategory} (${t.minutes} min)`)
          .join(", ")}`
      );
    }
  });

  // ── 5. Week-over-week trends ─────────────────────────────────────────────
  lines.push("\n=== WEEK-OVER-WEEK TRENDS ===");
  ctx.weekOverWeek.repetitiveWorkload.forEach((w) => {
    lines.push(
      `  ${w.week}: ${w.repetitivePercent}% repetitive ` +
        `(${w.repetitiveMinutes} min / ${w.totalMinutes} min total, ${w.sessionCount} sessions)`
    );
  });
  if (ctx.weekOverWeek.insights) {
    const ins = ctx.weekOverWeek.insights;
    if (ins.largestRepetitiveIncrease) {
      lines.push(
        `  Largest spike: ${ins.largestRepetitiveIncrease.fromWeek} → ${ins.largestRepetitiveIncrease.toWeek} (+${ins.largestRepetitiveIncrease.deltaPercent} pp)`
      );
    }
    if (ins.largestRepetitiveDecrease) {
      lines.push(
        `  Largest drop: ${ins.largestRepetitiveDecrease.fromWeek} → ${ins.largestRepetitiveDecrease.toWeek} (${ins.largestRepetitiveDecrease.deltaPercent} pp)`
      );
    }
    if (ins.fastestGrowingTask) {
      lines.push(
        `  Fastest-growing task: ${ins.fastestGrowingTask.taskCategory} (+${ins.fastestGrowingTask.deltaMinutes} min, ${ins.fastestGrowingTask.fromWeek} → ${ins.fastestGrowingTask.toWeek})`
      );
    }
    if (ins.biggestDeptShift) {
      lines.push(
        `  Biggest dept shift: ${ins.biggestDeptShift.department} ${ins.biggestDeptShift.direction === "increase" ? "+" : "-"}${ins.biggestDeptShift.deltaMinutes} min (${ins.biggestDeptShift.fromWeek} → ${ins.biggestDeptShift.toWeek})`
      );
    }
  }

  // ── 6. Anomalies ─────────────────────────────────────────────────────────
  lines.push("\n=== ANOMALIES ===");
  if (ctx.anomalies.length === 0) {
    lines.push("  No anomalies detected.");
  } else {
    ctx.anomalies.forEach((a) => {
      lines.push(`  [${a.severity.toUpperCase()}] ${a.title}`);
      lines.push(`    ${a.explanation}`);
      const metrics = Object.entries(a.supportingMetrics)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      lines.push(`    Metrics: ${metrics}`);
    });
  }

  // ── 7. Data quality ──────────────────────────────────────────────────────
  lines.push("\n=== DATA QUALITY ===");
  lines.push(`  Total raw rows: ${ctx.qualityReport.totalRawRows}`);
  lines.push(`  Normalized rows: ${ctx.qualityReport.normalizedRows}`);
  lines.push(`  Dropped rows: ${ctx.qualityReport.droppedRows}`);
  lines.push(`  Outlier rows excluded: ${ctx.qualityReport.outlierRows}`);
  lines.push(
    `  Employees missing metadata: ${ctx.qualityReport.employeesMissingMetadataCount} (${ctx.qualityReport.employeesMissingMetadata.join(", ") || "none"})`
  );
  lines.push(
    `  Duplicate employee conflicts resolved: ${ctx.qualityReport.duplicateEmployeeConflicts}`
  );

  return lines.join("\n");
}
