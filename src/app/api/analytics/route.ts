// Analytics API route — compute lightweight dashboard metrics
import { NextRequest } from "next/server";
import { loadAllData } from "../../../lib/data/loaders";
import { recoverableHours, recoverableInr, automationPriorityRanking, employeeBenchmarks, weekOverWeekTrends, detectAnomalies } from "../../../lib/data/analytics";

export async function GET() {
  return Response.json({ message: "analytics endpoint" });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { startDate, endDate, department } = body as { startDate?: string; endDate?: string; department?: string };

    const { logReport, empReport, joinReport, qualityReport } = loadAllData();

    // Helper: filter by date and department
    const filterNormalized = (row: any) => {
      if (department && row.department !== department) return false;
      if (startDate || endDate) {
        if (!row.timestamp) return false;
        const d = new Date(row.timestamp);
        if (startDate) {
          const s = new Date(startDate + "T00:00:00Z");
          if (d < s) return false;
        }
        if (endDate) {
          const e = new Date(endDate + "T23:59:59Z");
          if (d > e) return false;
        }
      }
      return true;
    };

    const filteredNormalized = logReport.normalized.filter(filterNormalized);
    const filteredEnriched = joinReport.enriched.filter(filterNormalized);

    const recoverable = recoverableHours(filteredNormalized);
    const inr = recoverableInr(filteredEnriched);
    const priority = automationPriorityRanking(filteredEnriched).slice(0, 5);
    const benchmarks = employeeBenchmarks(filteredEnriched);
    const weekTrends = weekOverWeekTrends(filteredNormalized);
    const anomalies = detectAnomalies(filteredEnriched);

    // ── Per-app breakdown (hours only — app not linked to compensation) ──────
    const appMap = new Map<string, { repetitiveMinutes: number; recoverableMinutes: number; sessions: number }>();
    for (const row of filteredNormalized) {
      if (row.durationMinutes === null || row.durationMinutes <= 0) continue;
      if (row.durationStatus === "invalid" || row.durationStatus === "flagged_zero") continue;
      if (!row.isRepetitive) continue;
      const feasibility = 0.7; // conservative default for app-level
      const entry = appMap.get(row.appName) ?? { repetitiveMinutes: 0, recoverableMinutes: 0, sessions: 0 };
      entry.repetitiveMinutes += row.durationMinutes;
      entry.recoverableMinutes += row.durationMinutes * feasibility;
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

    // Departments list for front-end selector
    const departments = Array.from(new Set(logReport.normalized.map((r: any) => r.department))).sort();

    return Response.json({
      meta: { totalRows: logReport.totalRaw, normalizedRows: logReport.normalized.length },
      departments,
      recoverable,
      recoverableInr: inr,
      automationPriority: priority,
      employeeBenchmarks: benchmarks,
      weekOverWeek: weekTrends,
      anomalies,
      qualityReport,
      byApp,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
