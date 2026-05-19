"use client";
import * as React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { formatINR } from "@/lib/utils/index";

type Dimension = "task" | "app" | "department";

interface TimeSinkChartProps {
  recoverable: any | null;
  recoverableInr: any | null;
  activeDept: string | null;
  activeTask: string | null;
  onDeptClick: (dept: string) => void;
  onTaskClick: (task: string) => void;
  loading?: boolean;
}

// ── Hook: measure container pixel size ───────────────────────────────────────
// Replaces ResponsiveContainer entirely. We observe the wrapper div and pass
// exact pixel dimensions to BarChart, so Recharts never sees -1x-1.
function useSize(ref: React.RefObject<HTMLDivElement | null>): { width: number; height: number } {
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = (w: number, h: number) => {
      if (w > 0 && h > 0) setSize({ width: Math.floor(w), height: Math.floor(h) });
    };

    // Read immediately in case the element already has size
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

// ── Tooltip ───────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, metric }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="rounded-md border bg-white shadow-sm px-3 py-2 text-sm">
      <div className="font-medium mb-1 text-gray-900">{label}</div>
      {metric === "hours" ? (
        <>
          <div className="text-gray-600">
            Recoverable:{" "}
            <span className="font-semibold">
              {Number(d?.recoverableHours ?? 0).toFixed(1)} hrs
            </span>
          </div>
          <div className="text-gray-500 text-xs mt-0.5">
            {Number(d?.repetitiveMinutes ?? 0).toLocaleString()} repetitive min
          </div>
        </>
      ) : (
        <>
          <div className="text-gray-600">
            Recoverable:{" "}
            <span className="font-semibold">{formatINR(d?.recoverableInr ?? 0)}</span>
          </div>
          {d?.employeeCount !== undefined && (
            <div className="text-gray-500 text-xs mt-0.5">
              {d.employeeCount} employees
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function TimeSinkChart({
  recoverable,
  recoverableInr,
  activeDept,
  activeTask,
  onDeptClick,
  onTaskClick,
  loading = false,
}: TimeSinkChartProps) {
  const [dimension, setDimension] = React.useState<Dimension>("task");
  const [metric, setMetric] = React.useState<"hours" | "inr">("hours");

  // ── Measure container — no ResponsiveContainer needed ──────────────────
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { width, height } = useSize(containerRef);

  // ── Chart data ──────────────────────────────────────────────────────────

  const chartData = React.useMemo(() => {
    if (!recoverable && !recoverableInr) return [];

    if (dimension === "task") {
      const hoursMap: Record<string, { repetitiveMinutes: number; recoverableMinutes: number }> = {};
      (recoverable?.byTaskCategory ?? []).forEach((t: any) => {
        hoursMap[t.taskCategory] = {
          repetitiveMinutes: t.repetitiveMinutes,
          recoverableMinutes: t.recoverableMinutes,
        };
      });
      const inrMap: Record<string, { recoverableInr: number; employeeCount: number }> = {};
      (recoverableInr?.byTaskCategory ?? []).forEach((t: any) => {
        inrMap[t.taskCategory] = {
          recoverableInr: t.recoverableInr,
          employeeCount: t.contributingEmployeeIds?.length ?? 0,
        };
      });
      const keys = new Set([...Object.keys(hoursMap), ...Object.keys(inrMap)]);
      return [...keys]
        .map((k) => ({
          name: k,
          recoverableHours: (hoursMap[k]?.recoverableMinutes ?? 0) / 60,
          repetitiveMinutes: hoursMap[k]?.repetitiveMinutes ?? 0,
          recoverableInr: inrMap[k]?.recoverableInr ?? 0,
          employeeCount: inrMap[k]?.employeeCount ?? 0,
        }))
        .sort((a, b) =>
          metric === "hours"
            ? b.recoverableHours - a.recoverableHours
            : b.recoverableInr - a.recoverableInr
        )
        .slice(0, 10);
    }

    if (dimension === "department") {
      const hoursMap: Record<string, { repetitiveMinutes: number; recoverableMinutes: number }> = {};
      (recoverable?.byDepartment ?? []).forEach((d: any) => {
        hoursMap[d.department] = {
          repetitiveMinutes: d.repetitiveMinutes,
          recoverableMinutes: d.recoverableMinutes,
        };
      });
      const inrMap: Record<string, { recoverableInr: number; employeeCount: number }> = {};
      (recoverableInr?.byDepartment ?? []).forEach((d: any) => {
        inrMap[d.department] = {
          recoverableInr: d.recoverableInr,
          employeeCount: d.contributingEmployeeIds?.length ?? 0,
        };
      });
      const keys = new Set([...Object.keys(hoursMap), ...Object.keys(inrMap)]);
      return [...keys]
        .map((k) => ({
          name: k,
          recoverableHours: (hoursMap[k]?.recoverableMinutes ?? 0) / 60,
          repetitiveMinutes: hoursMap[k]?.repetitiveMinutes ?? 0,
          recoverableInr: inrMap[k]?.recoverableInr ?? 0,
          employeeCount: inrMap[k]?.employeeCount ?? 0,
        }))
        .sort((a, b) =>
          metric === "hours"
            ? b.recoverableHours - a.recoverableHours
            : b.recoverableInr - a.recoverableInr
        );
    }

    // app — hours only
    const appData: any[] = recoverable?.byApp ?? [];
    return appData
      .map((a: any) => ({
        name: a.appName,
        recoverableHours: a.recoverableHours ?? (a.recoverableMinutes ?? 0) / 60,
        repetitiveMinutes: a.repetitiveMinutes ?? 0,
        recoverableInr: 0,
        employeeCount: 0,
      }))
      .sort((a, b) => b.recoverableHours - a.recoverableHours)
      .slice(0, 10);
  }, [recoverable, recoverableInr, dimension, metric]);

  const dataKey = metric === "hours" ? "recoverableHours" : "recoverableInr";
  const isClickable = dimension === "department" || dimension === "task";

  const handleBarClick = React.useCallback(
    (payload: any) => {
      const name: string = payload?.name ?? "";
      if (!name) return;
      if (dimension === "department") onDeptClick(name);
      else if (dimension === "task") onTaskClick(name);
    },
    [dimension, onDeptClick, onTaskClick]
  );

  const formatYAxis = (v: number) =>
    metric === "hours" ? `${v.toFixed(0)}h` : formatINR(v);

  // ── Loading skeleton ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="rounded-lg border bg-white shadow-sm p-5">
        <div className="h-6 w-48 animate-pulse rounded bg-gray-100 mb-4" />
        <div className="h-52 animate-pulse rounded bg-gray-50" />
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="rounded-lg border bg-white shadow-sm p-5">

      {/* Header + controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Time-Sink Breakdown</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {dimension === "department"
              ? "Click a bar to filter the entire dashboard by department"
              : dimension === "task"
              ? "Click a bar to filter the employee list by task"
              : "Top apps by repetitive hours"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Dimension switcher */}
          <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
            {(["task", "app", "department"] as Dimension[]).map((d) => (
              <button
                key={d}
                onClick={() => {
                  setDimension(d);
                  if (d === "app") setMetric("hours");
                }}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  dimension === d
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {d === "app" ? "App" : d === "task" ? "Task" : "Dept"}
              </button>
            ))}
          </div>

          {/* Metric switcher */}
          <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
            <button
              onClick={() => setMetric("hours")}
              className={`px-3 py-1.5 font-medium transition-colors ${
                metric === "hours"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Hours
            </button>
            <button
              onClick={() => { if (dimension !== "app") setMetric("inr"); }}
              disabled={dimension === "app"}
              title={dimension === "app" ? "INR not available at app level" : undefined}
              className={`px-3 py-1.5 font-medium transition-colors ${
                metric === "inr" && dimension !== "app"
                  ? "bg-blue-600 text-white"
                  : dimension === "app"
                  ? "bg-white text-gray-300 cursor-not-allowed"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              INR
            </button>
          </div>
        </div>
      </div>

      {/* Chart — container div is measured; BarChart gets explicit px dimensions */}
      {chartData.length === 0 ? (
        <div className="h-52 flex items-center justify-center text-sm text-gray-400">
          No data available for this dimension.
        </div>
      ) : (
        <div ref={containerRef} className="w-full h-52 sm:h-64">
          {width > 0 && height > 0 && (
            <BarChart
              width={width}
              height={height}
              data={chartData}
              margin={{ top: 4, right: 8, left: 4, bottom: 40 }}
              style={{ cursor: isClickable ? "pointer" : "default" }}
            >
              <CartesianGrid stroke="#f0f0f0" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatYAxis}
                width={52}
              />
              <Tooltip
                content={<ChartTooltip metric={metric} />}
                cursor={{ fill: "rgba(99,102,241,0.06)" }}
              />
              <Bar
                dataKey={dataKey}
                radius={[3, 3, 0, 0]}
                maxBarSize={48}
                onClick={isClickable ? handleBarClick : undefined}
                style={{ cursor: isClickable ? "pointer" : "default" }}
              >
                {chartData.map((entry) => {
                  const isActive =
                    (dimension === "department" && activeDept === entry.name) ||
                    (dimension === "task" && activeTask === entry.name);
                  const isDimmed =
                    (dimension === "department" && !!activeDept && activeDept !== entry.name) ||
                    (dimension === "task" && !!activeTask && activeTask !== entry.name);
                  return (
                    <Cell
                      key={entry.name}
                      fill={isActive ? "#7c3aed" : "#1d4ed8"}
                      opacity={isDimmed ? 0.3 : 1}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          )}
        </div>
      )}

      {/* Active filter hint */}
      {dimension === "department" && activeDept && (
        <p className="mt-2 text-xs text-blue-700 bg-blue-50 rounded px-2 py-1">
          Dashboard filtered to <strong>{activeDept}</strong>. Click the bar again or the badge above to clear.
        </p>
      )}
      {dimension === "task" && activeTask && (
        <p className="mt-2 text-xs text-purple-700 bg-purple-50 rounded px-2 py-1">
          Employee list filtered to <strong>{activeTask}</strong>. Click the bar again or the badge above to clear.
        </p>
      )}
    </div>
  );
}
