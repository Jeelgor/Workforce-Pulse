"use client";
import * as React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type {
  WeekOverWeekResult,
  WeeklyRepetitiveTrend,
  WeekOverWeekInsights,
} from "@/lib/data/analytics";

// Helper: compact week label
function shortWeekLabel(week: string): string {
  const m = week?.toString().match(/^\d{4}-(W\d{2})$/);
  return m ? m[1] : String(week ?? "");
}

function WoWTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as {
    repetitivePercent: number;
    repetitiveMinutes: number;
    totalMinutes: number;
    sessionCount: number;
  };
  return (
    <div className="rounded-md border bg-white shadow-sm px-3 py-2 text-sm">
      <div className="font-medium mb-1">{label}</div>
      <div className="text-gray-600">
        Repetitive: <span className="font-semibold text-gray-900">{Number(d.repetitivePercent).toFixed(1)}%</span>
      </div>
      <div className="text-gray-500 text-xs mt-0.5">
        {Number(d.repetitiveMinutes).toLocaleString()} min repetitive / {Number(d.totalMinutes).toLocaleString()} min total
      </div>
      <div className="text-gray-500 text-xs">{d.sessionCount} sessions</div>
    </div>
  );
}

function InsightPill({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: "up" | "down" | "neutral"; }) {
  const accentColor = accent === "up" ? "text-red-600" : accent === "down" ? "text-green-600" : "text-gray-700";
  return (
    <div className="rounded-md border bg-white p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`font-semibold text-sm ${accentColor}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function TrendsSection({ weekOverWeek }: { weekOverWeek?: WeekOverWeekResult | any | null }) {
  // Debug incoming prop (temporary)
  // eslint-disable-next-line no-console
  console.log("[TrendsSection] incoming weekOverWeek:", weekOverWeek);

  // Accept a few shapes: array, { repetitiveWorkload }, { repetitive_workload }, { week_over_week }
  let raw: any = weekOverWeek;
  if (typeof weekOverWeek === "string") {
    try {
      raw = JSON.parse(weekOverWeek);
      // eslint-disable-next-line no-console
      console.log("[TrendsSection] parsed JSON string for weekOverWeek");
    } catch (e) {
      // leave as-is
      // eslint-disable-next-line no-console
      console.warn("[TrendsSection] failed to parse weekOverWeek string");
    }
  }

  const workloadSource: any[] = Array.isArray(raw)
    ? raw
    : raw?.repetitiveWorkload ?? raw?.repetitive_workload ?? raw?.week_over_week ?? [];

  const insights: WeekOverWeekInsights | null = raw?.insights ?? null;

  // Normalize/coerce into a safe chart-friendly array
  const chartData = workloadSource
    .map((w: any) => ({
      week: w?.week ?? w?.week_IST ?? w?.weekLabel ?? w?.label ?? "",
      totalMinutes: Number(w?.totalMinutes ?? w?.total_min ?? 0),
      repetitiveMinutes: Number(w?.repetitiveMinutes ?? w?.rep ?? 0),
      repetitivePercent: Number(w?.repetitivePercent ?? w?.repPct ?? w?.repetitive_percent ?? 0),
      sessionCount: Number(w?.sessionCount ?? w?.sessions ?? 0),
    }))
    .map((r: any) => ({ ...r, label: shortWeekLabel(r.week) }));

  // Only empty when no data
  if (!chartData || chartData.length === 0) {
    return (
      <div className="rounded-lg border bg-white shadow-sm p-5 mt-4">
        <h3 className="text-base font-semibold mb-1">Week-over-Week Trends</h3>
        <p className="text-sm text-gray-500">No timestamped activity data available for trend analysis.</p>
      </div>
    );
  }

  // safe delta using coerced chartData
  const safeLatestDelta = chartData.length >= 2 ? chartData[chartData.length - 1].repetitivePercent - chartData[chartData.length - 2].repetitivePercent : null;

  return (
    <div className="rounded-lg border bg-white shadow-sm p-5 mt-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">Week-over-Week Trends</h3>
          <p className="text-xs text-gray-500 mt-0.5">Repetitive workload % across {chartData.length} week{chartData.length !== 1 ? "s" : ""}</p>
        </div>

        {safeLatestDelta !== null && (
          <div className={`text-sm font-medium px-2 py-1 rounded-md ${safeLatestDelta > 0 ? "bg-red-50 text-red-700" : safeLatestDelta < 0 ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-600"}`}>
            {safeLatestDelta > 0 ? "▲" : safeLatestDelta < 0 ? "▼" : "—"} {Math.abs(safeLatestDelta).toFixed(1)} pp vs prev week
          </div>
        )}
      </div>

      <div className="w-full h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 12, left: -8, bottom: 4 }}>
            <CartesianGrid stroke="#f0f0f0" strokeDasharray="4 4" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} width={36} />
            <Tooltip content={<WoWTooltip />} />
            <Line type="monotone" dataKey="repetitivePercent" stroke="#1d4ed8" strokeWidth={2} dot={{ r: 4, fill: "#1d4ed8", strokeWidth: 0 }} activeDot={{ r: 5 }} name="Repetitive %" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-gray-500">
              <th className="text-left pb-2 font-medium">Week</th>
              <th className="text-right pb-2 font-medium">Rep %</th>
              <th className="text-right pb-2 font-medium">Rep min</th>
              <th className="text-right pb-2 font-medium">Total min</th>
              <th className="text-right pb-2 font-medium">Sessions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {chartData.map((w: any, i: number) => {
              const prev = i > 0 ? chartData[i - 1].repetitivePercent : null;
              const delta = prev !== null ? w.repetitivePercent - prev : null;
              return (
                <tr key={w.week ?? i} className="text-gray-700">
                  <td className="py-2 font-medium">{w.week}</td>
                  <td className="py-2 text-right">
                    <span className="font-semibold">{Number(w.repetitivePercent).toFixed(1)}%</span>
                    {delta !== null && (
                      <span className={`ml-1.5 text-xs ${delta > 0 ? "text-red-500" : delta < 0 ? "text-green-500" : "text-gray-400"}`}>
                        {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"}{Math.abs(delta).toFixed(1)}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right text-gray-500">{Number(w.repetitiveMinutes).toLocaleString()}</td>
                  <td className="py-2 text-right text-gray-500">{Number(w.totalMinutes).toLocaleString()}</td>
                  <td className="py-2 text-right text-gray-500">{Number(w.sessionCount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {insights && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <InsightPill
            label="Largest spike"
            value={insights.largestRepetitiveIncrease ? `+${insights.largestRepetitiveIncrease.deltaPercent} pp` : "—"}
            sub={insights.largestRepetitiveIncrease ? `${insights.largestRepetitiveIncrease.fromWeek} → ${insights.largestRepetitiveIncrease.toWeek}` : undefined}
            accent={insights.largestRepetitiveIncrease ? "up" : "neutral"}
          />

          <InsightPill
            label="Largest drop"
            value={insights.largestRepetitiveDecrease ? `${insights.largestRepetitiveDecrease.deltaPercent} pp` : "—"}
            sub={insights.largestRepetitiveDecrease ? `${insights.largestRepetitiveDecrease.fromWeek} → ${insights.largestRepetitiveDecrease.toWeek}` : undefined}
            accent={insights.largestRepetitiveDecrease ? "down" : "neutral"}
          />

          <InsightPill
            label="Fastest-growing task"
            value={insights.fastestGrowingTask?.taskCategory ?? "—"}
            sub={insights.fastestGrowingTask ? `+${insights.fastestGrowingTask.deltaMinutes} min (${insights.fastestGrowingTask.fromWeek} → ${insights.fastestGrowingTask.toWeek})` : undefined}
            accent={insights.fastestGrowingTask ? "up" : "neutral"}
          />

          <InsightPill
            label="Biggest dept shift"
            value={insights.biggestDeptShift?.department ?? "—"}
            sub={insights.biggestDeptShift ? `${insights.biggestDeptShift.direction === "increase" ? "+" : "-"}${insights.biggestDeptShift.deltaMinutes} min (${insights.biggestDeptShift.fromWeek} → ${insights.biggestDeptShift.toWeek})` : undefined}
            accent={insights.biggestDeptShift ? (insights.biggestDeptShift.direction === "increase" ? "up" : "down") : "neutral"}
          />
        </div>
      )}
    </div>
  );
}
