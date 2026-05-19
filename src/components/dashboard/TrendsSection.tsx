"use client";
import * as React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { WeekOverWeekResult, WeekOverWeekInsights } from "@/lib/data/analytics";

// ── Hook: measure container pixel size (shared pattern with TimeSinkChart) ────
function useSize(ref: React.RefObject<HTMLDivElement | null>): { width: number; height: number } {
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = (w: number, h: number) => {
      if (w > 0 && h > 0) setSize({ width: Math.floor(w), height: Math.floor(h) });
    };
    update(el.offsetWidth, el.offsetHeight);
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) update(e.contentRect.width, e.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function shortWeek(week: string): string {
  const m = week?.toString().match(/^\d{4}-(W\d{2})$/);
  return m ? m[1] : String(week ?? "");
}

function RepTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="rounded-md border bg-white shadow-sm px-3 py-2 text-sm">
      <div className="font-medium mb-1">{label}</div>
      <div className="text-gray-600">
        Repetitive: <span className="font-semibold">{Number(d?.repetitivePercent ?? 0).toFixed(1)}%</span>
      </div>
      <div className="text-gray-500 text-xs mt-0.5">
        {Number(d?.repetitiveMinutes ?? 0).toLocaleString()} min repetitive / {Number(d?.totalMinutes ?? 0).toLocaleString()} min total
      </div>
      <div className="text-gray-500 text-xs">{d?.sessionCount} sessions</div>
    </div>
  );
}

function InsightPill({ label, value, sub, accent }: {
  label: string; value: React.ReactNode; sub?: string; accent?: "up" | "down" | "neutral";
}) {
  const color = accent === "up" ? "text-red-600" : accent === "down" ? "text-green-600" : "text-gray-700";
  return (
    <div className="rounded-md border bg-white p-2.5 min-w-0">
      <div className="text-xs text-gray-500 mb-1 truncate">{label}</div>
      <div className={`font-semibold text-sm truncate ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

export default function TrendsSection({
  weekOverWeek,
}: {
  weekOverWeek?: WeekOverWeekResult | any | null;
}) {
  let raw: any = weekOverWeek;
  if (typeof weekOverWeek === "string") {
    try { raw = JSON.parse(weekOverWeek); } catch { /* leave */ }
  }

  const workloadSource: any[] = Array.isArray(raw)
    ? raw
    : raw?.repetitiveWorkload ?? raw?.repetitive_workload ?? [];

  const insights: WeekOverWeekInsights | null = raw?.insights ?? null;

  const chartData = workloadSource
    .map((w: any) => ({
      week: w?.week ?? "",
      label: shortWeek(w?.week ?? ""),
      totalMinutes: Number(w?.totalMinutes ?? 0),
      repetitiveMinutes: Number(w?.repetitiveMinutes ?? 0),
      repetitivePercent: Number(w?.repetitivePercent ?? 0),
      sessionCount: Number(w?.sessionCount ?? 0),
    }))
    .sort((a, b) => a.week.localeCompare(b.week));

  if (!chartData || chartData.length === 0) {
    return (
      <div className="rounded-lg border bg-white shadow-sm p-5">
        <h3 className="text-base font-semibold mb-1">Week-over-Week Trends</h3>
        <p className="text-sm text-gray-500">No timestamped activity data available for trend analysis.</p>
      </div>
    );
  }

  const latestDelta =
    chartData.length >= 2
      ? chartData[chartData.length - 1].repetitivePercent -
        chartData[chartData.length - 2].repetitivePercent
      : null;

  const containerRef = React.useRef<HTMLDivElement>(null);
  const { width, height } = useSize(containerRef);

  return (
    <div className="rounded-lg border bg-white shadow-sm p-5">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">Week-over-Week Trends</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Repetitive workload % across {chartData.length} week{chartData.length !== 1 ? "s" : ""}
          </p>
        </div>
        {latestDelta !== null && (
          <div className={`text-sm font-medium px-2 py-1 rounded-md ${
            latestDelta > 0 ? "bg-red-50 text-red-700"
            : latestDelta < 0 ? "bg-green-50 text-green-700"
            : "bg-gray-50 text-gray-600"
          }`}>
            {latestDelta > 0 ? "▲" : latestDelta < 0 ? "▼" : "—"}{" "}
            {Math.abs(latestDelta).toFixed(1)} pp vs prev week
          </div>
        )}
      </div>

      {/* Line chart — repetitive-task share */}
      <div ref={containerRef} className="w-full h-44 sm:h-52">
        {width > 0 && height > 0 && (
          <LineChart
            width={width}
            height={height}
            data={chartData}
            margin={{ top: 4, right: 12, left: -8, bottom: 4 }}
          >
            <CartesianGrid stroke="#f0f0f0" strokeDasharray="4 4" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} width={36} />
            <Tooltip content={<RepTooltip />} />
            <Line
              type="monotone"
              dataKey="repetitivePercent"
              stroke="#1d4ed8"
              strokeWidth={2.5}
              dot={{ r: 5, fill: "#1d4ed8", strokeWidth: 0 }}
              activeDot={{ r: 6 }}
              name="Repetitive %"
            />
          </LineChart>
        )}
      </div>

      {/* Data table */}
      <div className="mt-4 overflow-x-auto -mx-5 px-5">
        <table className="w-full min-w-[380px] text-sm">
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
            {chartData.map((w, i) => {
              const prev = i > 0 ? chartData[i - 1].repetitivePercent : null;
              const delta = prev !== null ? w.repetitivePercent - prev : null;
              return (
                <tr key={w.week} className="text-gray-700">
                  <td className="py-2 font-medium">{w.week}</td>
                  <td className="py-2 text-right">
                    <span className="font-semibold">{w.repetitivePercent.toFixed(1)}%</span>
                    {delta !== null && (
                      <span className={`ml-1.5 text-xs ${delta > 0 ? "text-red-500" : delta < 0 ? "text-green-500" : "text-gray-400"}`}>
                        {delta > 0 ? "▲" : "▼"}{Math.abs(delta).toFixed(1)}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right text-gray-500">{w.repetitiveMinutes.toLocaleString()}</td>
                  <td className="py-2 text-right text-gray-500">{w.totalMinutes.toLocaleString()}</td>
                  <td className="py-2 text-right text-gray-500">{w.sessionCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Insight pills */}
      {insights && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
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
