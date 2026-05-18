import DashboardShell from "@/components/dashboard/DashboardShell";
import { loadAllData } from "@/lib/data/loaders";
import {
  recoverableHours,
  recoverableInr,
  automationPriorityRanking,
  employeeBenchmarks,
  weekOverWeekTrends,
  detectAnomalies,
} from "@/lib/data/analytics";

export default function DashboardPage() {
  const { logReport, joinReport, qualityReport } = loadAllData();

  const recoverable = recoverableHours(logReport.normalized);
  const inr = recoverableInr(joinReport.enriched);
  const priority = automationPriorityRanking(joinReport.enriched).slice(0, 5);
  const benchmarks = employeeBenchmarks(joinReport.enriched).slice(0, 5);
  // ── WoW trends must be computed here so the initial render has data ──────
  const weekTrends = weekOverWeekTrends(logReport.normalized);
  const anomalies = detectAnomalies(joinReport.enriched);

  const departments = Array.from(
    new Set(logReport.normalized.map((r) => r.department))
  ).sort() as string[];

  const initial = {
    meta: {
      totalRows: logReport.totalRaw,
      normalizedRows: logReport.normalized.length,
    },
    departments,
    recoverable,
    recoverableInr: inr,
    automationPriority: priority,
    employeeBenchmarks: benchmarks,
    // ── included so TrendsSection renders on first load ───────────────────
    weekOverWeek: weekTrends,
    anomalies,
    qualityReport,
  };

  return (
    <main>
      <DashboardShell initial={initial} />
    </main>
  );
}

