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
  const weekTrends = weekOverWeekTrends(logReport.normalized);
  const anomalies = detectAnomalies(joinReport.enriched);

  const departments = Array.from(
    new Set(logReport.normalized.map((r) => r.department))
  ).sort() as string[];

  // Per-app breakdown for the time-sink chart
  const appMap = new Map<string, { repetitiveMinutes: number; recoverableMinutes: number; sessions: number }>();
  for (const row of logReport.normalized) {
    if (row.durationMinutes === null || row.durationMinutes <= 0) continue;
    if (row.durationStatus === "invalid" || row.durationStatus === "flagged_zero") continue;
    if (!row.isRepetitive) continue;
    const entry = appMap.get(row.appName) ?? { repetitiveMinutes: 0, recoverableMinutes: 0, sessions: 0 };
    entry.repetitiveMinutes += row.durationMinutes;
    entry.recoverableMinutes += row.durationMinutes * 0.7;
    entry.sessions += 1;
    appMap.set(row.appName, entry);
  }
  const byApp = [...appMap.entries()]
    .map(([appName, v]) => ({
      appName,
      repetitiveMinutes: Math.round(v.repetitiveMinutes * 100) / 100,
      recoverableMinutes: Math.round(v.recoverableMinutes * 100) / 100,
      recoverableHours: Math.round((v.recoverableMinutes / 60) * 100) / 100,
      sessions: v.sessions,
    }))
    .sort((a, b) => b.recoverableMinutes - a.recoverableMinutes);

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
    weekOverWeek: weekTrends,
    anomalies,
    qualityReport,
    byApp,
  };

  return (
    <main>
      <DashboardShell initial={initial} />
    </main>
  );
}

