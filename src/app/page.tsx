import DashboardShell from "../components/dashboard/DashboardShell";
import { loadAllData } from "../lib/data/loaders";
import { recoverableHours, recoverableInr, automationPriorityRanking, employeeBenchmarks, weekOverWeekTrends, detectAnomalies } from "../lib/data/analytics";

export default function Home() {
  const { logReport, joinReport, qualityReport } = loadAllData();

  const recoverable = recoverableHours(logReport.normalized);
  const inr = recoverableInr(joinReport.enriched);
  const priority = automationPriorityRanking(joinReport.enriched).slice(0, 5);
  const benchmarks = employeeBenchmarks(joinReport.enriched);
  const weekTrends = weekOverWeekTrends(logReport.normalized);
  const anomalies = detectAnomalies(joinReport.enriched);

  const initial = {
    meta: { totalRows: logReport.totalRaw, normalizedRows: logReport.normalized.length },
    departments: Array.from(new Set(logReport.normalized.map((r) => r.department))).sort(),
    recoverable,
    recoverableInr: inr,
    automationPriority: priority,
    employeeBenchmarks: benchmarks,
    // include week-over-week trends for the initial render
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
