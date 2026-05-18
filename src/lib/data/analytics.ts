// =============================================================================
// analytics.ts — Workforce Pulse analytics engine
// =============================================================================
//
// All functions are pure, strongly typed, and free of UI concerns.
// Every aggregate preserves references to contributing rows / employee IDs
// so results are fully auditable.
// =============================================================================

import type {
  EnrichedActivityLog,
  NormalizedActivityLog,
  ActivityLogReport,
  EmployeeReport,
  JoinReport,
  DataQualityReport,
} from "./types";
import { istISOWeek } from "../utils/index";

// =============================================================================
// ── SECTION 0: SHARED TYPES ───────────────────────────────────────────────────
// =============================================================================

export interface AppUsageStat {
  appName: string;
  totalMinutes: number;
  sessionCount: number;
  avgMinutesPerSession: number;
}

export interface DepartmentStat {
  department: string;
  totalMinutes: number;
  sessionCount: number;
  uniqueEmployees: number;
  avgMinutesPerEmployee: number;
}

export interface EmployeeActivityStat {
  employeeId: string;
  name: string;
  department: string;
  totalMinutes: number;
  sessionCount: number;
  uniqueApps: number;
  topApp: string | null;
  topTaskCategory: string | null;
}

export interface TaskCategoryStat {
  taskCategory: string;
  totalMinutes: number;
  sessionCount: number;
}

// =============================================================================
// ── SECTION 1: RECOVERABLE HOURS ─────────────────────────────────────────────
// =============================================================================

/**
 * Automation feasibility multiplier per task category (0–1).
 *
 * Business rationale:
 *  1.0 = fully automatable today with current tooling
 *  0.9 = near-fully automatable; minimal human review needed
 *  0.8 = largely automatable; some exception handling required
 *  0.7 = mostly automatable; periodic human judgment needed
 *  0.5 = partially automatable; significant judgment still required
 *  0.3 = low automation potential; relationship or creative work
 *  0.1 = minimal automation potential; human presence essential
 *
 * Revision notes (v2):
 *  - CRM Updates: 0.8 → 0.9  (modern CRMs auto-log most interactions)
 *  - Email Triage: 0.7 → 0.8  (AI email tools now handle routing reliably)
 *  - Data Entry: kept at 1.0  (RPA-ready, no judgment required)
 *  - Reconciliation: kept at 1.0  (rule-based, fully scriptable)
 *  - Invoice Processing: kept at 0.9  (OCR + workflow automation mature)
 *
 * These are conservative, defensible estimates — not ML predictions.
 */
export const AUTOMATION_FEASIBILITY: Record<string, number> = {
  "Data Entry":          1.0,
  "Reconciliation":      1.0,
  "Invoice Processing":  0.9,
  "Lead Entry":          0.9,
  "Bookkeeping":         0.9,
  "CRM Updates":         0.9,  // v2: raised from 0.8 — CRM auto-logging is mature
  "Reporting":           0.8,
  "Email Triage":        0.8,  // v2: raised from 0.7 — AI email routing is reliable
  "GST Prep":            0.8,
  "Calendar Management": 0.7,
  "Status Updates":      0.7,
  "Ticket Updates":      0.7,
  "Vendor Portals":      0.6,
  "Vendor Management":   0.6,
  "Pipeline Review":     0.4,
  "Documentation":       0.4,
  "Notes":               0.4,
  "Internal Comms":      0.3,
  "Client Comms":        0.3,
  "Research":            0.3,
  "Deck Building":       0.3,
  "Document Drafting":   0.3,
  "Meetings":            0.2,
  "Client Call":         0.1,
  "Unknown":             0.0,
};

/** Default feasibility for task categories not in the map */
const DEFAULT_FEASIBILITY = 0.5;

// ---------------------------------------------------------------------------
// Analytics metadata — tracks exclusion policy for every KPI calculation
// ---------------------------------------------------------------------------

/**
 * Attached to every KPI result so consumers (dashboard, AI, exports) can
 * explain exactly which rows were included and why others were excluded.
 */
export interface AnalyticsMetadata {
  /** Total rows considered before any filtering */
  totalRowsConsidered: number;
  /** Rows excluded because durationStatus was "invalid" or "flagged_zero" */
  rowsExcludedInvalidDuration: number;
  /** Rows excluded because isRepetitive === false */
  rowsExcludedNonRepetitive: number;
  /**
   * Outlier rows (durationStatus === "outlier").
   * Excluded from KPI totals by default; tracked here for transparency.
   */
  outlierRowsTracked: number;
  /** Whether outliers were included in this calculation */
  outliersIncluded: boolean;
  /**
   * Rows skipped because the employee had no hourly compensation data.
   * Only relevant for INR calculations; 0 for hour-based calculations.
   */
  rowsSkippedNoCompensation: number;
}

export interface RecoverableHoursByDept {
  department: string;
  repetitiveMinutes: number;
  recoverableMinutes: number;
  /** Row indices that contributed to this bucket (for audit) */
  contributingRows: number[];
}

export interface RecoverableHoursByTask {
  taskCategory: string;
  automationFeasibility: number;
  repetitiveMinutes: number;
  recoverableMinutes: number;
  contributingRows: number[];
}

export interface RecoverableHoursResult {
  /** Total repetitive minutes across all valid rows */
  totalRepetitiveMinutes: number;
  /** After applying automation feasibility multipliers */
  totalRecoverableMinutes: number;
  /** Convenience: totalRecoverableMinutes / 60 */
  totalRecoverableHours: number;
  byDepartment: RecoverableHoursByDept[];
  byTaskCategory: RecoverableHoursByTask[];
  /** Outlier rows tracked separately — not included in totals */
  outlierRowIndices: number[];
  /** Audit trail explaining what was included/excluded */
  metadata: AnalyticsMetadata;
}

/**
 * Calculates recoverable hours from repetitive activity logs.
 *
 * Formula per row:
 *   recoverableMinutes = durationMinutes × automationFeasibility(taskCategory)
 *
 * Only rows where isRepetitive === true AND durationStatus === "valid" are
 * included. Outliers (durationStatus === "outlier") are tracked separately
 * so callers can decide whether to include them.
 *
 * @param logs  Normalised activity logs (NormalizedActivityLog[])
 * @param includeOutliers  Default false — outliers skew totals significantly
 */
export function recoverableHours(
  logs: NormalizedActivityLog[],
  includeOutliers = false
): RecoverableHoursResult {
  const deptMap = new Map<string, { repMin: number; recMin: number; rows: number[] }>();
  const taskMap = new Map<string, { feasibility: number; repMin: number; recMin: number; rows: number[] }>();
  const outlierRowIndices: number[] = [];

  let totalRepMin = 0;
  let totalRecMin = 0;
  let excludedInvalid = 0;
  let excludedNonRep = 0;

  for (const log of logs) {
    if (log.durationMinutes === null || log.durationMinutes <= 0) { excludedInvalid++; continue; }
    if (log.durationStatus === "invalid" || log.durationStatus === "flagged_zero") { excludedInvalid++; continue; }

    if (log.durationStatus === "outlier") {
      outlierRowIndices.push(log.rowIndex);
      if (!includeOutliers) continue;
    }

    if (!log.isRepetitive) { excludedNonRep++; continue; }

    const feasibility = AUTOMATION_FEASIBILITY[log.taskCategory] ?? DEFAULT_FEASIBILITY;
    const repMin = log.durationMinutes;
    const recMin = repMin * feasibility;

    totalRepMin += repMin;
    totalRecMin += recMin;

    const dept = deptMap.get(log.department) ?? { repMin: 0, recMin: 0, rows: [] };
    dept.repMin += repMin;
    dept.recMin += recMin;
    dept.rows.push(log.rowIndex);
    deptMap.set(log.department, dept);

    const task = taskMap.get(log.taskCategory) ?? { feasibility, repMin: 0, recMin: 0, rows: [] };
    task.repMin += repMin;
    task.recMin += recMin;
    task.rows.push(log.rowIndex);
    taskMap.set(log.taskCategory, task);
  }

  return {
    totalRepetitiveMinutes: round2(totalRepMin),
    totalRecoverableMinutes: round2(totalRecMin),
    totalRecoverableHours: round2(totalRecMin / 60),
    byDepartment: [...deptMap.entries()]
      .map(([department, v]) => ({
        department,
        repetitiveMinutes: round2(v.repMin),
        recoverableMinutes: round2(v.recMin),
        contributingRows: v.rows,
      }))
      .sort((a, b) => b.recoverableMinutes - a.recoverableMinutes),
    byTaskCategory: [...taskMap.entries()]
      .map(([taskCategory, v]) => ({
        taskCategory,
        automationFeasibility: v.feasibility,
        repetitiveMinutes: round2(v.repMin),
        recoverableMinutes: round2(v.recMin),
        contributingRows: v.rows,
      }))
      .sort((a, b) => b.recoverableMinutes - a.recoverableMinutes),
    outlierRowIndices,
    metadata: {
      totalRowsConsidered: logs.length,
      rowsExcludedInvalidDuration: excludedInvalid,
      rowsExcludedNonRepetitive: excludedNonRep,
      outlierRowsTracked: outlierRowIndices.length,
      outliersIncluded: includeOutliers,
      rowsSkippedNoCompensation: 0,
    },
  };
}

// =============================================================================
// ── SECTION 2: RECOVERABLE INR ───────────────────────────────────────────────
// =============================================================================

export interface RecoverableInrByDept {
  department: string;
  recoverableMinutes: number;
  recoverableInr: number;
  contributingEmployeeIds: string[];
  contributingRows: number[];
}

export interface RecoverableInrByTask {
  taskCategory: string;
  automationFeasibility: number;
  recoverableMinutes: number;
  recoverableInr: number;
  contributingEmployeeIds: string[];
  contributingRows: number[];
}

export interface RecoverableInrResult {
  /**
   * Total estimated recoverable INR per month.
   *
   * Formula per row:
   *   recoverableMinutes = durationMinutes × automationFeasibility
   *   recoverableHours   = recoverableMinutes / 60
   *   recoverableInr     = recoverableHours × employee.hourlyCostInr
   *
   * Rows where employee compensation is unknown are excluded and counted
   * in metadata.rowsSkippedNoCompensation.
   */
  totalRecoverableInr: number;
  byDepartment: RecoverableInrByDept[];
  byTaskCategory: RecoverableInrByTask[];
  /** Audit trail explaining what was included/excluded */
  metadata: AnalyticsMetadata;
}

/**
 * Calculates estimated recoverable monthly INR from repetitive work.
 *
 * Requires EnrichedActivityLog[] so employee hourly rates are available.
 * Rows without employee metadata or without hourlyCostInr are skipped.
 */
export function recoverableInr(
  logs: EnrichedActivityLog[],
  includeOutliers = false
): RecoverableInrResult {
  const deptMap = new Map<string, {
    recMin: number; recInr: number;
    empIds: Set<string>; rows: number[];
  }>();
  const taskMap = new Map<string, {
    feasibility: number; recMin: number; recInr: number;
    empIds: Set<string>; rows: number[];
  }>();

  let totalInr = 0;
  let skipped = 0;
  let excludedInvalid = 0;
  let excludedNonRep = 0;
  let outlierCount = 0;

  for (const log of logs) {
    if (log.durationMinutes === null || log.durationMinutes <= 0) { excludedInvalid++; continue; }
    if (log.durationStatus === "invalid" || log.durationStatus === "flagged_zero") { excludedInvalid++; continue; }
    if (log.durationStatus === "outlier") {
      outlierCount++;
      if (!includeOutliers) continue;
    }
    if (!log.isRepetitive) { excludedNonRep++; continue; }

    const hourlyRate = log.employee?.compensation.hourlyCostInr;
    if (!hourlyRate) { skipped++; continue; }

    const feasibility = AUTOMATION_FEASIBILITY[log.taskCategory] ?? DEFAULT_FEASIBILITY;
    const recMin = log.durationMinutes * feasibility;
    const recInr = (recMin / 60) * hourlyRate;

    totalInr += recInr;

    const dept = deptMap.get(log.department) ?? {
      recMin: 0, recInr: 0, empIds: new Set<string>(), rows: [],
    };
    dept.recMin += recMin;
    dept.recInr += recInr;
    dept.empIds.add(log.employeeId);
    dept.rows.push(log.rowIndex);
    deptMap.set(log.department, dept);

    const task = taskMap.get(log.taskCategory) ?? {
      feasibility, recMin: 0, recInr: 0, empIds: new Set<string>(), rows: [],
    };
    task.recMin += recMin;
    task.recInr += recInr;
    task.empIds.add(log.employeeId);
    task.rows.push(log.rowIndex);
    taskMap.set(log.taskCategory, task);
  }

  return {
    totalRecoverableInr: round2(totalInr),
    byDepartment: [...deptMap.entries()]
      .map(([department, v]) => ({
        department,
        recoverableMinutes: round2(v.recMin),
        recoverableInr: round2(v.recInr),
        contributingEmployeeIds: [...v.empIds],
        contributingRows: v.rows,
      }))
      .sort((a, b) => b.recoverableInr - a.recoverableInr),
    byTaskCategory: [...taskMap.entries()]
      .map(([taskCategory, v]) => ({
        taskCategory,
        automationFeasibility: v.feasibility,
        recoverableMinutes: round2(v.recMin),
        recoverableInr: round2(v.recInr),
        contributingEmployeeIds: [...v.empIds],
        contributingRows: v.rows,
      }))
      .sort((a, b) => b.recoverableInr - a.recoverableInr),
    metadata: {
      totalRowsConsidered: logs.length,
      rowsExcludedInvalidDuration: excludedInvalid,
      rowsExcludedNonRepetitive: excludedNonRep,
      outlierRowsTracked: outlierCount,
      outliersIncluded: includeOutliers,
      rowsSkippedNoCompensation: skipped,
    },
  };
}

// =============================================================================
// ── SECTION 3: AUTOMATION PRIORITY RANKING ───────────────────────────────────
// =============================================================================

export interface AutomationPriorityItem {
  taskCategory: string;
  /**
   * Composite priority score normalised to 0–100.
   *
   * Formula (weighted sum, then min-max normalised):
   *   raw = (repetitiveRatio   × 0.30)   // how repetitive is this task?
   *       + (inrImpactRatio    × 0.35)   // how much money is at stake?
   *       + (employeeConc      × 0.20)   // how many employees are affected?
   *       + (volumeRatio       × 0.15)   // how many sessions does it generate?
   *
   * Weights are business-defensible: INR impact is the primary driver,
   * followed by repetitiveness, then breadth (employee count), then volume.
   */
  score: number;
  automationFeasibility: number;
  repetitiveMinutes: number;
  estimatedInrImpact: number;
  employeeCount: number;
  sessionCount: number;
  contributingRows: number[];
}

/**
 * Ranks task categories by automation priority using a weighted composite score.
 * All four component ratios are computed relative to the max across all tasks,
 * making the score stable regardless of dataset size.
 */
export function automationPriorityRanking(
  logs: EnrichedActivityLog[]
): AutomationPriorityItem[] {
  // First pass: accumulate raw metrics per task category
  const map = new Map<string, {
    repMin: number; inr: number;
    empIds: Set<string>; sessions: number; rows: number[];
  }>();

  for (const log of logs) {
    if (log.durationMinutes === null || log.durationMinutes <= 0) continue;
    if (log.durationStatus === "invalid" || log.durationStatus === "flagged_zero") continue;
    if (!log.isRepetitive) continue;

    const feasibility = AUTOMATION_FEASIBILITY[log.taskCategory] ?? DEFAULT_FEASIBILITY;
    const recMin = log.durationMinutes * feasibility;
    const hourlyRate = log.employee?.compensation.hourlyCostInr ?? 0;
    const inr = (recMin / 60) * hourlyRate;

    const entry = map.get(log.taskCategory) ?? {
      repMin: 0, inr: 0, empIds: new Set<string>(), sessions: 0, rows: [],
    };
    entry.repMin += recMin;
    entry.inr += inr;
    entry.empIds.add(log.employeeId);
    entry.sessions += 1;
    entry.rows.push(log.rowIndex);
    map.set(log.taskCategory, entry);
  }

  if (map.size === 0) return [];

  // Second pass: compute ratios relative to max values (min-max normalisation)
  const allRepMin  = [...map.values()].map(v => v.repMin);
  const allInr     = [...map.values()].map(v => v.inr);
  const allEmpCnt  = [...map.values()].map(v => v.empIds.size);
  const allSess    = [...map.values()].map(v => v.sessions);

  const maxRepMin  = Math.max(...allRepMin)  || 1;
  const maxInr     = Math.max(...allInr)     || 1;
  const maxEmpCnt  = Math.max(...allEmpCnt)  || 1;
  const maxSess    = Math.max(...allSess)    || 1;

  type ScoredItem = AutomationPriorityItem & { _rawScore: number };

  const items: ScoredItem[] = [...map.entries()].map(([taskCategory, v]) => {
    const feasibility = AUTOMATION_FEASIBILITY[taskCategory] ?? DEFAULT_FEASIBILITY;

    // Each ratio is 0–1; multiply by feasibility so low-feasibility tasks
    // are naturally deprioritised even if they have high volume/cost
    const repetitiveRatio = (v.repMin / maxRepMin) * feasibility;
    const inrImpactRatio  = (v.inr    / maxInr)    * feasibility;
    const employeeConc    = (v.empIds.size / maxEmpCnt);
    const volumeRatio     = (v.sessions   / maxSess);

    const rawScore =
      repetitiveRatio * 0.30 +
      inrImpactRatio  * 0.35 +
      employeeConc    * 0.20 +
      volumeRatio     * 0.15;

    return {
      taskCategory,
      score: 0, // filled in normalisation pass below
      automationFeasibility: feasibility,
      repetitiveMinutes: round2(v.repMin),
      estimatedInrImpact: round2(v.inr),
      employeeCount: v.empIds.size,
      sessionCount: v.sessions,
      contributingRows: v.rows,
      _rawScore: rawScore,
    };
  });

  // Normalise rawScore to 0–100
  const maxRaw = Math.max(...items.map(i => i._rawScore)) || 1;
  for (const item of items) {
    item.score = round2((item._rawScore / maxRaw) * 100);
    delete (item as Partial<ScoredItem>)._rawScore;
  }

  return items.sort((a, b) => b.score - a.score);
}

// =============================================================================
// ── SECTION 4: EMPLOYEE BENCHMARKING ─────────────────────────────────────────
// =============================================================================

export interface EmployeeBenchmark {
  employeeId: string;
  name: string;
  role: string;
  department: string;
  totalMinutes: number;
  sessionCount: number;
  repetitiveMinutes: number;
  /** repetitiveMinutes / totalMinutes × 100 */
  repetitivePercent: number;
  /** Top 3 repetitive task categories by minutes */
  topRepetitiveTasks: { taskCategory: string; minutes: number }[];
  estimatedRepetitiveCostInr: number;
  /** Peer comparison within the same role */
  peerComparison: {
    roleAvgRepetitivePercent: number;
    /** positive = above average, negative = below */
    deltaFromRoleAvg: number;
    peerCount: number;
  };
}

/**
 * Benchmarks each employee's repetitive workload against peers in the same role.
 *
 * Peer group = employees sharing the exact same normalised role string.
 * Employees with fewer than 2 peers get peerCount = 0 and delta = 0
 * (insufficient data for meaningful comparison).
 */
export function employeeBenchmarks(
  logs: EnrichedActivityLog[]
): EmployeeBenchmark[] {
  // Accumulate per-employee metrics
  const empMap = new Map<string, {
    name: string; role: string; department: string;
    totalMin: number; repMin: number; sessionCount: number;
    tasks: Map<string, number>;
    hourlyRate: number | null;
  }>();

  for (const log of logs) {
    if (log.durationMinutes === null || log.durationMinutes <= 0) continue;
    if (log.durationStatus === "invalid" || log.durationStatus === "flagged_zero") continue;

    const emp = log.employee;
    const entry = empMap.get(log.employeeId) ?? {
      name: emp?.name ?? log.employeeId,
      role: emp?.role ?? "Unknown",
      department: log.department,
      totalMin: 0,
      sessionCount: 0,
      repMin: 0,
      tasks: new Map<string, number>(),
      hourlyRate: emp?.compensation.hourlyCostInr ?? null,
    };

    entry.totalMin += log.durationMinutes;
    entry.sessionCount += 1;

    if (log.isRepetitive) {
      entry.repMin += log.durationMinutes;
      entry.tasks.set(
        log.taskCategory,
        (entry.tasks.get(log.taskCategory) ?? 0) + log.durationMinutes
      );
    }

    empMap.set(log.employeeId, entry);
  }

  // Build role → repetitivePercent[] map for peer averaging
  const rolePercents = new Map<string, number[]>();
  for (const [, v] of empMap) {
    const pct = v.totalMin > 0 ? (v.repMin / v.totalMin) * 100 : 0;
    const arr = rolePercents.get(v.role) ?? [];
    arr.push(pct);
    rolePercents.set(v.role, arr);
  }

  return [...empMap.entries()]
    .map(([employeeId, v]) => {
      const repPct = v.totalMin > 0 ? round2((v.repMin / v.totalMin) * 100) : 0;
      const topTasks = [...v.tasks.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([taskCategory, minutes]) => ({ taskCategory, minutes: round2(minutes) }));

      const repCostInr = v.hourlyRate
        ? round2((v.repMin / 60) * v.hourlyRate)
        : 0;

      const peers = rolePercents.get(v.role) ?? [];
      const peerCount = peers.length - 1; // exclude self
      const roleAvg = peers.length > 0
        ? round2(peers.reduce((s, p) => s + p, 0) / peers.length)
        : 0;

      return {
        employeeId,
        name: v.name,
        role: v.role,
        department: v.department,
        totalMinutes: round2(v.totalMin),
        sessionCount: v.sessionCount,
        repetitiveMinutes: round2(v.repMin),
        repetitivePercent: repPct,
        topRepetitiveTasks: topTasks,
        estimatedRepetitiveCostInr: repCostInr,
        peerComparison: {
          roleAvgRepetitivePercent: roleAvg,
          deltaFromRoleAvg: peerCount > 0 ? round2(repPct - roleAvg) : 0,
          peerCount,
        },
      };
    })
    .sort((a, b) => b.repetitivePercent - a.repetitivePercent);
}

// =============================================================================
// ── SECTION 5: WEEK-OVER-WEEK TRENDS ─────────────────────────────────────────
// =============================================================================

/** ISO week key: "2025-W42" */
export type WeekKey = string;

export interface WeeklyRepetitiveTrend {
  week: WeekKey;
  totalMinutes: number;
  repetitiveMinutes: number;
  /** repetitiveMinutes / totalMinutes × 100 */
  repetitivePercent: number;
  sessionCount: number;
}

export interface WeeklyTaskTrend {
  week: WeekKey;
  taskCategory: string;
  repetitiveMinutes: number;
  sessionCount: number;
}

export interface WeeklyDeptTrend {
  week: WeekKey;
  department: string;
  totalMinutes: number;
  repetitiveMinutes: number;
  uniqueEmployees: number;
}

export interface WeekOverWeekResult {
  /** Overall repetitive workload % per week, sorted chronologically */
  repetitiveWorkload: WeeklyRepetitiveTrend[];
  /** Per-task-category repetitive minutes per week */
  taskTrends: WeeklyTaskTrend[];
  /** Per-department activity per week */
  departmentTrends: WeeklyDeptTrend[];
  /** Derived WoW delta insights — null when fewer than 2 weeks of data */
  insights: WeekOverWeekInsights | null;
}

export interface WeekOverWeekInsights {
  /**
   * Week with the largest increase in repetitive workload %.
   * delta = thisWeek.repetitivePercent − prevWeek.repetitivePercent
   */
  largestRepetitiveIncrease: {
    fromWeek: WeekKey;
    toWeek: WeekKey;
    deltaPercent: number;
  } | null;

  /**
   * Week with the largest decrease in repetitive workload %.
   */
  largestRepetitiveDecrease: {
    fromWeek: WeekKey;
    toWeek: WeekKey;
    deltaPercent: number;
  } | null;

  /**
   * Task category with the biggest absolute increase in repetitive minutes
   * between any two consecutive weeks.
   */
  fastestGrowingTask: {
    taskCategory: string;
    fromWeek: WeekKey;
    toWeek: WeekKey;
    deltaMinutes: number;
  } | null;

  /**
   * Department with the biggest absolute shift (increase or decrease) in
   * repetitive minutes between any two consecutive weeks.
   */
  biggestDeptShift: {
    department: string;
    fromWeek: WeekKey;
    toWeek: WeekKey;
    deltaMinutes: number;
    direction: "increase" | "decrease";
  } | null;
}

/**
 * Builds week-over-week trend analytics using IST-anchored timestamps.
 *
 * Rows with null timestamps are excluded (no week can be assigned).
 * Weeks are keyed as "YYYY-Www" (ISO 8601) for natural sort order.
 */
export function weekOverWeekTrends(
  logs: NormalizedActivityLog[]
): WeekOverWeekResult {
  // TEMP DEBUG: log incoming normalized logs summary
  // eslint-disable-next-line no-console
  console.log("[analytics] weekOverWeekTrends received logs:", logs.length);
  // print small sample (rowIndex + whether timestamp exists)
  // eslint-disable-next-line no-console
  console.log(
    "[analytics] sample rows:",
    logs.slice(0, 3).map((r) => ({ rowIndex: r.rowIndex, hasTimestamp: !!r.timestamp, tsISO: r.timestamp ? r.timestamp.toISOString() : null }))
  );
  const repMap  = new Map<WeekKey, { total: number; rep: number; sessions: number }>();
  const taskMap = new Map<string, { rep: number; sessions: number }>();  // key: "week|task"
  const deptMap = new Map<string, { total: number; rep: number; empIds: Set<string> }>(); // key: "week|dept"

  for (const log of logs) {
    if (log.durationMinutes === null || log.durationMinutes <= 0) continue;
    if (log.durationStatus === "invalid" || log.durationStatus === "flagged_zero") continue;
    if (!log.timestamp) continue;

    const { year, week } = istISOWeek(log.timestamp);
    const wk: WeekKey = `${year}-W${String(week).padStart(2, "0")}`;

    const rep = repMap.get(wk) ?? { total: 0, rep: 0, sessions: 0 };
    rep.total += log.durationMinutes;
    if (log.isRepetitive) rep.rep += log.durationMinutes;
    rep.sessions += 1;
    repMap.set(wk, rep);

    if (log.isRepetitive) {
      const tk = `${wk}|${log.taskCategory}`;
      const t = taskMap.get(tk) ?? { rep: 0, sessions: 0 };
      t.rep += log.durationMinutes;
      t.sessions += 1;
      taskMap.set(tk, t);
    }

    const dk = `${wk}|${log.department}`;
    const d = deptMap.get(dk) ?? { total: 0, rep: 0, empIds: new Set<string>() };
    d.total += log.durationMinutes;
    if (log.isRepetitive) d.rep += log.durationMinutes;
    d.empIds.add(log.employeeId);
    deptMap.set(dk, d);
  }

  const repetitiveWorkload: WeeklyRepetitiveTrend[] = [...repMap.entries()]
    .map(([week, v]) => ({
      week,
      totalMinutes: round2(v.total),
      repetitiveMinutes: round2(v.rep),
      repetitivePercent: v.total > 0 ? round2((v.rep / v.total) * 100) : 0,
      sessionCount: v.sessions,
    }))
    .sort((a, b) => a.week.localeCompare(b.week));

  const taskTrends: WeeklyTaskTrend[] = [...taskMap.entries()]
    .map(([key, v]) => {
      const [week, taskCategory] = key.split("|");
      return { week, taskCategory, repetitiveMinutes: round2(v.rep), sessionCount: v.sessions };
    })
    .sort((a, b) => a.week.localeCompare(b.week) || b.repetitiveMinutes - a.repetitiveMinutes);

  const departmentTrends: WeeklyDeptTrend[] = [...deptMap.entries()]
    .map(([key, v]) => {
      const [week, department] = key.split("|");
      return {
        week, department,
        totalMinutes: round2(v.total),
        repetitiveMinutes: round2(v.rep),
        uniqueEmployees: v.empIds.size,
      };
    })
    .sort((a, b) => a.week.localeCompare(b.week));

  // ── WoW delta insights ───────────────────────────────────────────────────

  const insights = buildWoWInsights(
    repetitiveWorkload,
    taskTrends,
    departmentTrends
  );

  // TEMP DEBUG: log computed workload summary
  // eslint-disable-next-line no-console
  console.log("[analytics] repetitiveWorkload.length:", repetitiveWorkload.length);
  // eslint-disable-next-line no-console
  console.log("[analytics] repetitiveWorkload sample:", repetitiveWorkload.slice(0, 3));

  return { repetitiveWorkload, taskTrends, departmentTrends, insights };
}

/**
 * Derives the four WoW delta insights from the already-computed trend arrays.
 * Returns null when fewer than 2 weeks of data exist (no deltas possible).
 */
function buildWoWInsights(
  workload: WeeklyRepetitiveTrend[],
  taskTrends: WeeklyTaskTrend[],
  deptTrends: WeeklyDeptTrend[]
): WeekOverWeekInsights | null {
  if (workload.length < 2) return null;

  // ── 1 & 2: Largest repetitive% increase / decrease ───────────────────────

  let maxIncrease = -Infinity;
  let maxDecrease = Infinity;
  let increaseFrom = ""; let increaseTo = "";
  let decreaseFrom = ""; let decreaseTo = "";

  for (let i = 1; i < workload.length; i++) {
    const delta = workload[i].repetitivePercent - workload[i - 1].repetitivePercent;
    if (delta > maxIncrease) {
      maxIncrease = delta;
      increaseFrom = workload[i - 1].week;
      increaseTo   = workload[i].week;
    }
    if (delta < maxDecrease) {
      maxDecrease = delta;
      decreaseFrom = workload[i - 1].week;
      decreaseTo   = workload[i].week;
    }
  }

  // ── 3: Fastest-growing task category ─────────────────────────────────────

  // Build map: taskCategory → week → repetitiveMinutes
  const taskByWeek = new Map<string, Map<WeekKey, number>>();
  for (const t of taskTrends) {
    const inner = taskByWeek.get(t.taskCategory) ?? new Map<WeekKey, number>();
    inner.set(t.week, t.repetitiveMinutes);
    taskByWeek.set(t.taskCategory, inner);
  }

  const weeks = workload.map(w => w.week); // already sorted
  let fastestTask = "";
  let fastestFrom = ""; let fastestTo = "";
  let fastestDelta = -Infinity;

  for (const [task, weekMap] of taskByWeek) {
    for (let i = 1; i < weeks.length; i++) {
      const prev = weekMap.get(weeks[i - 1]) ?? 0;
      const curr = weekMap.get(weeks[i])     ?? 0;
      const delta = curr - prev;
      if (delta > fastestDelta) {
        fastestDelta = delta;
        fastestTask  = task;
        fastestFrom  = weeks[i - 1];
        fastestTo    = weeks[i];
      }
    }
  }

  // ── 4: Department with biggest WoW shift ─────────────────────────────────

  // Build map: department → week → repetitiveMinutes
  const deptByWeek = new Map<string, Map<WeekKey, number>>();
  for (const d of deptTrends) {
    const inner = deptByWeek.get(d.department) ?? new Map<WeekKey, number>();
    inner.set(d.week, d.repetitiveMinutes);
    deptByWeek.set(d.department, inner);
  }

  let biggestDept = "";
  let biggestFrom = ""; let biggestTo = "";
  let biggestAbsDelta = -Infinity;
  let biggestRawDelta = 0;

  for (const [dept, weekMap] of deptByWeek) {
    for (let i = 1; i < weeks.length; i++) {
      const prev = weekMap.get(weeks[i - 1]) ?? 0;
      const curr = weekMap.get(weeks[i])     ?? 0;
      const delta = curr - prev;
      if (Math.abs(delta) > biggestAbsDelta) {
        biggestAbsDelta = Math.abs(delta);
        biggestRawDelta = delta;
        biggestDept = dept;
        biggestFrom = weeks[i - 1];
        biggestTo   = weeks[i];
      }
    }
  }

  return {
    largestRepetitiveIncrease: maxIncrease > 0
      ? { fromWeek: increaseFrom, toWeek: increaseTo, deltaPercent: round2(maxIncrease) }
      : null,
    largestRepetitiveDecrease: maxDecrease < 0
      ? { fromWeek: decreaseFrom, toWeek: decreaseTo, deltaPercent: round2(maxDecrease) }
      : null,
    fastestGrowingTask: fastestDelta > 0 && fastestTask
      ? { taskCategory: fastestTask, fromWeek: fastestFrom, toWeek: fastestTo, deltaMinutes: round2(fastestDelta) }
      : null,
    biggestDeptShift: biggestDept
      ? {
          department: biggestDept,
          fromWeek: biggestFrom,
          toWeek: biggestTo,
          deltaMinutes: round2(Math.abs(biggestRawDelta)),
          direction: biggestRawDelta >= 0 ? "increase" : "decrease",
        }
      : null,
  };
}

// =============================================================================
// ── SECTION 6: ANOMALY DETECTION ─────────────────────────────────────────────
// =============================================================================

export type AnomalyType =
  | "high_repetitive_employee"        // employee far above role average
  | "high_repetitive_department"      // department far above org average
  | "extreme_task_concentration"      // one task dominates an employee's time
  | "dept_task_concentration"         // one task dominates a whole department
  | "outlier_duration";               // row with duration > 720 min

export type AnomalySeverity = "low" | "medium" | "high";

export interface Anomaly {
  type: AnomalyType;
  /** Short display title (suitable for a card header) */
  title: string;
  /** Human-readable explanation suitable for display or AI context */
  explanation: string;
  /** Numeric evidence supporting the flag */
  supportingMetrics: Record<string, number | string>;
  /** low / medium / high — derived from how far the value exceeds the threshold */
  severity: AnomalySeverity;
  /** Employee IDs involved */
  employeeIds: string[];
  /** Row indices involved */
  rowIndices: number[];
}

/**
 * Thresholds for deterministic anomaly detection.
 * All values are business-defensible and documented.
 */
const ANOMALY_THRESHOLDS = {
  /**
   * Employee repetitive% delta above role average.
   * medium: ≥ 20 pp above average
   * high:   ≥ 35 pp above average
   */
  employeeRepetitiveDeltaMedium: 20,
  employeeRepetitiveDeltaHigh:   35,

  /**
   * Department repetitive% delta above org average.
   * medium: ≥ 15 pp above average
   * high:   ≥ 25 pp above average
   */
  deptRepetitiveDeltaMedium: 15,
  deptRepetitiveDeltaHigh:   25,

  /**
   * Single task % of an employee's total minutes.
   * medium: ≥ 60%
   * high:   ≥ 75%
   */
  taskConcentrationMedium: 60,
  taskConcentrationHigh:   75,

  /**
   * Single task % of a department's total repetitive minutes.
   * medium: ≥ 55%
   * high:   ≥ 70%
   */
  deptTaskConcentrationMedium: 55,
  deptTaskConcentrationHigh:   70,
} as const;

/** Derive severity from a delta value and two thresholds */
function severityFromDelta(
  delta: number,
  mediumThreshold: number,
  highThreshold: number
): AnomalySeverity {
  if (delta >= highThreshold) return "high";
  if (delta >= mediumThreshold) return "medium";
  return "low";
}

/**
 * Detects anomalies using deterministic threshold logic.
 * No ML — every flag has a clear numeric explanation and severity level.
 *
 * Anomaly types:
 *  1. high_repetitive_employee   — individual far above role peers
 *  2. high_repetitive_department — department far above org average
 *  3. extreme_task_concentration — one task dominates an employee's time
 *  4. dept_task_concentration    — one task dominates a department's repetitive work
 *  5. outlier_duration           — rows with duration > 720 min
 */
export function detectAnomalies(logs: EnrichedActivityLog[]): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // ── Pre-compute per-employee metrics ─────────────────────────────────────

  const empMap = new Map<string, {
    name: string; role: string; department: string;
    totalMin: number; repMin: number;
    tasks: Map<string, number>; rows: number[];
  }>();

  const deptMap = new Map<string, {
    totalMin: number; repMin: number;
    empIds: Set<string>;
    taskRepMin: Map<string, number>;
  }>();

  for (const log of logs) {
    if (log.durationMinutes === null || log.durationMinutes <= 0) continue;
    if (log.durationStatus === "invalid" || log.durationStatus === "flagged_zero") continue;

    const emp = empMap.get(log.employeeId) ?? {
      name: log.employee?.name ?? log.employeeId,
      role: log.employee?.role ?? "Unknown",
      department: log.department,
      totalMin: 0, repMin: 0,
      tasks: new Map<string, number>(), rows: [],
    };
    emp.totalMin += log.durationMinutes;
    if (log.isRepetitive) {
      emp.repMin += log.durationMinutes;
      emp.tasks.set(log.taskCategory,
        (emp.tasks.get(log.taskCategory) ?? 0) + log.durationMinutes);
    }
    emp.rows.push(log.rowIndex);
    empMap.set(log.employeeId, emp);

    const dept = deptMap.get(log.department) ?? {
      totalMin: 0, repMin: 0,
      empIds: new Set<string>(),
      taskRepMin: new Map<string, number>(),
    };
    dept.totalMin += log.durationMinutes;
    if (log.isRepetitive) {
      dept.repMin += log.durationMinutes;
      dept.taskRepMin.set(log.taskCategory,
        (dept.taskRepMin.get(log.taskCategory) ?? 0) + log.durationMinutes);
    }
    dept.empIds.add(log.employeeId);
    deptMap.set(log.department, dept);
  }

  // ── 1. High repetitive employee ──────────────────────────────────────────

  const roleMap = new Map<string, number[]>();
  for (const [, v] of empMap) {
    const pct = v.totalMin > 0 ? (v.repMin / v.totalMin) * 100 : 0;
    const arr = roleMap.get(v.role) ?? [];
    arr.push(pct);
    roleMap.set(v.role, arr);
  }
  const roleAvgMap = new Map<string, number>();
  for (const [role, pcts] of roleMap) {
    roleAvgMap.set(role, pcts.reduce((s, p) => s + p, 0) / pcts.length);
  }

  for (const [empId, v] of empMap) {
    const empPct = v.totalMin > 0 ? (v.repMin / v.totalMin) * 100 : 0;
    const avg = roleAvgMap.get(v.role) ?? 0;
    const delta = empPct - avg;
    if (delta >= ANOMALY_THRESHOLDS.employeeRepetitiveDeltaMedium) {
      const severity = severityFromDelta(
        delta,
        ANOMALY_THRESHOLDS.employeeRepetitiveDeltaMedium,
        ANOMALY_THRESHOLDS.employeeRepetitiveDeltaHigh
      );
      anomalies.push({
        type: "high_repetitive_employee",
        title: `High repetitive workload — ${v.name}`,
        explanation:
          `${v.name} (${v.role}) has ${round2(empPct)}% repetitive workload, ` +
          `${round2(delta)} pp above the role average of ${round2(avg)}%. ` +
          `This suggests manual work that peers have automated or delegated.`,
        supportingMetrics: {
          repetitivePercent: round2(empPct),
          roleAvgPercent: round2(avg),
          deltaAboveAvg: round2(delta),
          repetitiveMinutes: round2(v.repMin),
          totalMinutes: round2(v.totalMin),
        },
        severity,
        employeeIds: [empId],
        rowIndices: v.rows,
      });
    }
  }

  // ── 2. High repetitive department ────────────────────────────────────────

  let orgTotal = 0; let orgRep = 0;
  for (const [, v] of deptMap) { orgTotal += v.totalMin; orgRep += v.repMin; }
  const orgAvgPct = orgTotal > 0 ? (orgRep / orgTotal) * 100 : 0;

  for (const [dept, v] of deptMap) {
    const deptPct = v.totalMin > 0 ? (v.repMin / v.totalMin) * 100 : 0;
    const delta = deptPct - orgAvgPct;
    if (delta >= ANOMALY_THRESHOLDS.deptRepetitiveDeltaMedium) {
      const severity = severityFromDelta(
        delta,
        ANOMALY_THRESHOLDS.deptRepetitiveDeltaMedium,
        ANOMALY_THRESHOLDS.deptRepetitiveDeltaHigh
      );
      anomalies.push({
        type: "high_repetitive_department",
        title: `High repetitive burden — ${dept}`,
        explanation:
          `${dept} has ${round2(deptPct)}% repetitive workload across ` +
          `${v.empIds.size} employee(s), ${round2(delta)} pp above the org ` +
          `average of ${round2(orgAvgPct)}%. Consider department-level automation.`,
        supportingMetrics: {
          deptRepetitivePercent: round2(deptPct),
          orgAvgPercent: round2(orgAvgPct),
          deltaAboveAvg: round2(delta),
          uniqueEmployees: v.empIds.size,
          deptRepetitiveMinutes: round2(v.repMin),
        },
        severity,
        employeeIds: [...v.empIds],
        rowIndices: [],
      });
    }
  }

  // ── 3. Extreme task concentration (employee level) ────────────────────────

  for (const [empId, v] of empMap) {
    if (v.totalMin === 0) continue;
    for (const [task, taskMin] of v.tasks) {
      const taskPct = (taskMin / v.totalMin) * 100;
      if (taskPct >= ANOMALY_THRESHOLDS.taskConcentrationMedium) {
        const severity = severityFromDelta(
          taskPct,
          ANOMALY_THRESHOLDS.taskConcentrationMedium,
          ANOMALY_THRESHOLDS.taskConcentrationHigh
        );
        anomalies.push({
          type: "extreme_task_concentration",
          title: `Task concentration — ${v.name} on "${task}"`,
          explanation:
            `${v.name} spends ${round2(taskPct)}% of total recorded time on ` +
            `"${task}". Over-reliance on a single task type may indicate a ` +
            `bottleneck or a strong automation opportunity.`,
          supportingMetrics: {
            taskPercent: round2(taskPct),
            taskMinutes: round2(taskMin),
            totalMinutes: round2(v.totalMin),
          },
          severity,
          employeeIds: [empId],
          rowIndices: v.rows,
        });
      }
    }
  }

  // ── 4. Department task concentration ─────────────────────────────────────

  for (const [dept, v] of deptMap) {
    if (v.repMin === 0) continue;
    for (const [task, taskRepMin] of v.taskRepMin) {
      const taskPct = (taskRepMin / v.repMin) * 100;
      if (taskPct >= ANOMALY_THRESHOLDS.deptTaskConcentrationMedium) {
        const severity = severityFromDelta(
          taskPct,
          ANOMALY_THRESHOLDS.deptTaskConcentrationMedium,
          ANOMALY_THRESHOLDS.deptTaskConcentrationHigh
        );
        anomalies.push({
          type: "dept_task_concentration",
          title: `Dept task concentration — ${dept} on "${task}"`,
          explanation:
            `"${task}" accounts for ${round2(taskPct)}% of all repetitive ` +
            `minutes in ${dept}. This concentration suggests a department-wide ` +
            `automation opportunity with broad impact.`,
          supportingMetrics: {
            taskShareOfDeptRepetitive: round2(taskPct),
            taskRepetitiveMinutes: round2(taskRepMin),
            deptTotalRepetitiveMinutes: round2(v.repMin),
            uniqueEmployeesInDept: v.empIds.size,
          },
          severity,
          employeeIds: [...v.empIds],
          rowIndices: [],
        });
      }
    }
  }

  // ── 5. Outlier duration rows ──────────────────────────────────────────────

  const outlierRows = logs.filter(l => l.durationStatus === "outlier");
  if (outlierRows.length > 0) {
    const maxDur = Math.max(...outlierRows.map(r => r.durationMinutes ?? 0));
    anomalies.push({
      type: "outlier_duration",
      title: `Duration outliers — ${outlierRows.length} row(s) excluded`,
      explanation:
        `${outlierRows.length} row(s) have duration > 720 minutes (max: ${maxDur} min) ` +
        `and were excluded from all KPI calculations. These are likely data entry errors.`,
      supportingMetrics: {
        outlierCount: outlierRows.length,
        maxDurationMinutes: maxDur,
        affectedEmployees: new Set(outlierRows.map(r => r.employeeId)).size,
      },
      severity: "high",
      employeeIds: [...new Set(outlierRows.map(r => r.employeeId))],
      rowIndices: outlierRows.map(r => r.rowIndex),
    });
  }

  // Sort: high → medium → low
  const severityOrder: Record<AnomalySeverity, number> = { high: 0, medium: 1, low: 2 };
  return anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

// =============================================================================
// ── SECTION 7: EXISTING AGGREGATIONS (preserved) ─────────────────────────────
// =============================================================================

/**
 * Filters to only rows with a valid, positive duration.
 * Generic so the subtype (EnrichedActivityLog) is preserved by callers.
 */
function validDurationRows<T extends NormalizedActivityLog>(
  logs: T[],
  includeOutliers = true
): T[] {
  return logs.filter(
    (l) =>
      l.durationMinutes !== null &&
      l.durationMinutes > 0 &&
      (includeOutliers || l.durationStatus !== "outlier")
  );
}

export function appUsageStats(logs: NormalizedActivityLog[]): AppUsageStat[] {
  const map = new Map<string, { totalMinutes: number; sessionCount: number }>();
  for (const log of validDurationRows(logs)) {
    const e = map.get(log.appName) ?? { totalMinutes: 0, sessionCount: 0 };
    e.totalMinutes += log.durationMinutes!;
    e.sessionCount += 1;
    map.set(log.appName, e);
  }
  return [...map.entries()]
    .map(([appName, s]) => ({
      appName,
      totalMinutes: s.totalMinutes,
      sessionCount: s.sessionCount,
      avgMinutesPerSession: round2(s.totalMinutes / s.sessionCount),
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes);
}

export function departmentStats(logs: NormalizedActivityLog[]): DepartmentStat[] {
  const map = new Map<string, { totalMinutes: number; sessionCount: number; employees: Set<string> }>();
  for (const log of validDurationRows(logs)) {
    const e = map.get(log.department) ?? { totalMinutes: 0, sessionCount: 0, employees: new Set<string>() };
    e.totalMinutes += log.durationMinutes!;
    e.sessionCount += 1;
    e.employees.add(log.employeeId);
    map.set(log.department, e);
  }
  return [...map.entries()]
    .map(([department, s]) => ({
      department,
      totalMinutes: s.totalMinutes,
      sessionCount: s.sessionCount,
      uniqueEmployees: s.employees.size,
      avgMinutesPerEmployee: round2(s.totalMinutes / s.employees.size),
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes);
}

export function employeeActivityStats(logs: EnrichedActivityLog[]): EmployeeActivityStat[] {
  const map = new Map<string, {
    name: string; department: string;
    totalMinutes: number; sessionCount: number;
    apps: Map<string, number>; tasks: Map<string, number>;
  }>();
  for (const log of validDurationRows(logs)) {
    const e = map.get(log.employeeId) ?? {
      name: log.employee?.name ?? log.employeeId,
      department: log.department,
      totalMinutes: 0, sessionCount: 0,
      apps: new Map<string, number>(), tasks: new Map<string, number>(),
    };
    e.totalMinutes += log.durationMinutes!;
    e.sessionCount += 1;
    e.apps.set(log.appName, (e.apps.get(log.appName) ?? 0) + log.durationMinutes!);
    e.tasks.set(log.taskCategory, (e.tasks.get(log.taskCategory) ?? 0) + log.durationMinutes!);
    map.set(log.employeeId, e);
  }
  return [...map.entries()]
    .map(([employeeId, s]) => ({
      employeeId, name: s.name, department: s.department,
      totalMinutes: s.totalMinutes, sessionCount: s.sessionCount,
      uniqueApps: s.apps.size,
      topApp: topKey(s.apps), topTaskCategory: topKey(s.tasks),
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes);
}

export function taskCategoryStats(logs: NormalizedActivityLog[]): TaskCategoryStat[] {
  const map = new Map<string, { totalMinutes: number; sessionCount: number }>();
  for (const log of validDurationRows(logs)) {
    const e = map.get(log.taskCategory) ?? { totalMinutes: 0, sessionCount: 0 };
    e.totalMinutes += log.durationMinutes!;
    e.sessionCount += 1;
    map.set(log.taskCategory, e);
  }
  return [...map.entries()]
    .map(([taskCategory, s]) => ({ taskCategory, totalMinutes: s.totalMinutes, sessionCount: s.sessionCount }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes);
}

// =============================================================================
// ── SECTION 8: DATA QUALITY REPORT (preserved) ───────────────────────────────
// =============================================================================

export function buildDataQualityReport(
  logReport: ActivityLogReport,
  empReport: EmployeeReport,
  joinReport: JoinReport
): DataQualityReport {
  let invalidRows = 0;
  let outlierRows = 0;
  for (const row of logReport.normalized) {
    if (row.durationStatus === "invalid") invalidRows++;
    if (row.durationStatus === "outlier") outlierRows++;
  }
  return {
    totalRawRows:              logReport.totalRaw,
    normalizedRows:            logReport.normalized.length,
    droppedRows:               logReport.rowsDropped,
    fixedRows:                 logReport.rowsFixed,
    flaggedRows:               logReport.rowsFlagged,
    duplicateRowsRemoved:      logReport.duplicatesRemoved,
    invalidRows,
    outlierRows,
    duplicateEmployeeConflicts: empReport.duplicatesResolved,
    employeesMissingMetadata:      joinReport.missingMetadata,
    metadataWithoutActivity:       joinReport.noActivity,
    employeesMissingMetadataCount: joinReport.missingMetadata.length,
    metadataWithoutActivityCount:  joinReport.noActivity.length,
    generatedAt: new Date().toISOString(),
  };
}

// =============================================================================
// ── INTERNAL HELPERS ──────────────────────────────────────────────────────────
// =============================================================================

/** Round to 2 decimal places */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Returns the key with the highest value in a Map<string, number> */
function topKey(map: Map<string, number>): string | null {
  let best: string | null = null;
  let bestVal = -Infinity;
  for (const [k, v] of map) {
    if (v > bestVal) { bestVal = v; best = k; }
  }
  return best;
}
