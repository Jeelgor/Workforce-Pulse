"use client";
import * as React from "react";
import HeaderFilters from "./HeaderFilters";
import KPICard from "./KPICard";
import TimeSinkChart from "./TimeSinkChart";
import PriorityTable from "./PriorityTable";
import EmployeeDrilldown from "./EmployeeDrilldown";
import TrendsSection from "./TrendsSection";
import AnomalyCallout from "./AnomalyCallout";
import AssistantPanel from "@/components/ai/AssistantPanel";
import ExportButton from "@/components/export/ExportButton";
import type { ExportPayload } from "@/lib/export/pdf";

// ── INR methodology tooltip ───────────────────────────────────────────────────
function InrMethodologyTooltip() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Show INR methodology"
        className="ml-1 text-gray-400 hover:text-blue-600 transition-colors"
      >
        <svg className="w-3.5 h-3.5 inline" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-50 w-72 rounded-lg border bg-white shadow-lg p-3 text-xs text-gray-700 space-y-1.5">
          <div className="font-semibold text-gray-900 mb-1">INR Methodology</div>
          <p><strong>Formula per row:</strong></p>
          <p className="font-mono bg-gray-50 rounded p-1.5 text-[11px] leading-relaxed">
            recoverableMin = duration × automationFeasibility<br />
            recoverableHrs = recoverableMin ÷ 60<br />
            recoverableINR = recoverableHrs × hourlyCostINR
          </p>
          <p><strong>Automation feasibility</strong> is a per-task multiplier (0–1). Data Entry = 1.0, CRM Updates = 0.9, Email Triage = 0.8, Meetings = 0.2.</p>
          <p><strong>Hourly cost</strong> from HRMS: annual CTC ÷ 12 ÷ 160 hrs, or LPA × 100,000 ÷ 12 ÷ 160, or direct hourly rate.</p>
          <p className="text-gray-500">Only isRepetitive = true rows with valid duration included. Rows without compensation data excluded and counted separately.</p>
          <button onClick={() => setOpen(false)} className="mt-1 text-blue-600 hover:underline">Close</button>
        </div>
      )}
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ number, title, sub }: { number: string; title: string; sub?: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-3">
      <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 shrink-0">
        {number}
      </span>
      <div>
        <h2 className="text-base font-semibold text-gray-900 leading-tight">{title}</h2>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Data quality panel ────────────────────────────────────────────────────────
function DataQualityPanel({ qualityReport, meta }: { qualityReport: any; meta: any }) {
  return (
    <div className="rounded-lg border bg-white shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Data Quality</h3>
      <dl className="space-y-1.5 text-sm">
        {[
          ["Normalized rows",        meta?.normalizedRows,                          ""],
          ["Total raw rows",         meta?.totalRows,                               ""],
          ["Dropped rows",           qualityReport?.droppedRows,                    ""],
          ["Fixed rows",             qualityReport?.fixedRows,                      ""],
          ["Duplicates removed",     qualityReport?.duplicateRowsRemoved,           ""],
          ["Outlier rows (>720 min)",qualityReport?.outlierRows,                    "text-amber-600"],
          ["Missing metadata",       qualityReport?.employeesMissingMetadataCount,  "text-red-600"],
          ["Duplicate emp. conflicts",qualityReport?.duplicateEmployeeConflicts,    "text-amber-600"],
          ["Metadata w/o activity",  qualityReport?.metadataWithoutActivityCount,   ""],
        ].map(([label, val, cls]) => (
          <div key={label as string} className="flex justify-between">
            <dt className="text-gray-500">{label}</dt>
            <dd className={`font-medium ${cls}`}>{val ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ── Main shell ────────────────────────────────────────────────────────────────
export default function DashboardShell({ initial }: { initial: any }) {
  const [metrics, setMetrics] = React.useState<any>(initial);
  const [loading, setLoading]   = React.useState(false);

  const [activeFilters, setActiveFilters] = React.useState<{
    department?: string;
    startDate?: string;
    endDate?: string;
  }>({});

  // Cross-filter 1: department (re-fetches full dashboard)
  const [activeDeptFilter, setActiveDeptFilter] = React.useState<string | null>(null);
  // Cross-filter 2: task category (client-side — filters employee drilldown)
  const [activeTaskFilter, setActiveTaskFilter] = React.useState<string | null>(null);

  // ── Header filter apply ─────────────────────────────────────────────────
  const apply = React.useCallback(
    async (filters: { startDate?: string; endDate?: string; department?: string }) => {
      setActiveFilters(filters);
      setActiveDeptFilter(null);
      setActiveTaskFilter(null);
      setLoading(true);
      try {
        const res = await fetch("/api/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(filters),
        });
        if (res.ok) setMetrics(await res.json());
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ── Cross-filter 1: department click ────────────────────────────────────
  const handleDeptClick = React.useCallback(
    async (dept: string) => {
      const newDept = activeDeptFilter === dept ? undefined : dept;
      setActiveDeptFilter(newDept ?? null);
      const filters = { ...activeFilters, department: newDept };
      setActiveFilters(filters);
      setLoading(true);
      try {
        const res = await fetch("/api/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(filters),
        });
        if (res.ok) setMetrics(await res.json());
      } finally {
        setLoading(false);
      }
    },
    [activeDeptFilter, activeFilters]
  );

  // ── Cross-filter 2: task category click ─────────────────────────────────
  const handleTaskClick = React.useCallback((task: string) => {
    setActiveTaskFilter((prev) => (prev === task ? null : task));
  }, []);

  // ── Derived values ───────────────────────────────────────────────────────
  const prioritized = metrics?.automationPriority ?? [];

  const anomalies: any[] = React.useMemo(
    () => metrics?.anomalies ?? [],
    [metrics?.anomalies]
  );

  // Employee list filtered by task cross-filter
  const filteredBenchmarks = React.useMemo(() => {
    const all: any[] = metrics?.employeeBenchmarks ?? [];
    if (!activeTaskFilter) return all;
    return all.filter((b: any) =>
      b.topRepetitiveTasks?.some((t: any) => t.taskCategory === activeTaskFilter)
    );
  }, [metrics?.employeeBenchmarks, activeTaskFilter]);

  // Export payload
  const getExportPayload = React.useCallback((): ExportPayload | null => {
    if (!metrics?.recoverable || !metrics?.recoverableInr || !metrics?.qualityReport) return null;
    return {
      generatedAt: new Date().toISOString(),
      filters: activeFilters,
      recoverable: metrics.recoverable,
      recoverableInr: metrics.recoverableInr,
      automationPriority: metrics.automationPriority ?? [],
      employeeBenchmarks: metrics.employeeBenchmarks ?? [],
      weekOverWeek: metrics.weekOverWeek ?? null,
      anomalies: metrics.anomalies ?? [],
      qualityReport: metrics.qualityReport,
    };
  }, [metrics, activeFilters]);

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 space-y-8">

        {/* ════════════════════════════════════════════════════════════════
            HEADER — sticky, filters + export
        ════════════════════════════════════════════════════════════════ */}
        <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b bg-slate-50 sticky top-0 z-40 pt-2">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 truncate">
              Workforce Pulse
            </h1>
            <p className="text-sm text-gray-500 mt-0.5 hidden sm:block">
              Executive operations dashboard · where are we wasting the most time and money?
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <ExportButton getPayload={getExportPayload} />
            <HeaderFilters departments={metrics?.departments ?? []} onApply={apply} />
          </div>
        </header>

        {/* Active cross-filter badges */}
        {(activeDeptFilter || activeTaskFilter) && (
          <div className="flex flex-wrap items-center gap-2 -mt-4">
            <span className="text-xs text-gray-500 font-medium">Filtering by:</span>
            {activeDeptFilter && (
              <button
                onClick={() => handleDeptClick(activeDeptFilter)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium hover:bg-blue-200 transition-colors"
              >
                Dept: {activeDeptFilter}
                <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            {activeTaskFilter && (
              <button
                onClick={() => setActiveTaskFilter(null)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-medium hover:bg-purple-200 transition-colors"
              >
                Task: {activeTaskFilter}
                <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SECTION 1 — Two defensible headline numbers
        ════════════════════════════════════════════════════════════════ */}
        <section>
          <SectionLabel
            number="1"
            title="Headline Numbers"
            sub="Hours and cost recoverable through automation — based on joined HRMS compensation data"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <KPICard
              title="Recoverable Hours / Month"
              value={metrics?.recoverable?.totalRecoverableHours ?? "—"}
              description={
                metrics?.recoverable?.totalRepetitiveMinutes
                  ? `${metrics.recoverable.totalRepetitiveMinutes.toLocaleString()} repetitive min × automation feasibility`
                  : "Repetitive hours recoverable through automation"
              }
              meta={[`${metrics?.meta?.normalizedRows ?? "—"} normalized rows`]}
              icon="clock"
              loading={loading}
            />
            <KPICard
              title="Recoverable INR / Month"
              value={metrics?.recoverableInr?.totalRecoverableInr ?? "—"}
              description={
                metrics?.recoverableInr?.metadata?.rowsSkippedNoCompensation !== undefined
                  ? `${metrics.recoverableInr.metadata.rowsSkippedNoCompensation} rows excluded (no compensation data)`
                  : "Estimated monthly cost recoverable"
              }
              meta={["Joined HRMS data · click ⓘ for formula"]}
              icon="currency"
              loading={loading}
              methodologySlot={<InrMethodologyTooltip />}
            />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            SECTION 2 — Time-sink breakdown
            Cross-filter 1: clicking a department bar re-fetches the dashboard
        ════════════════════════════════════════════════════════════════ */}
        <section>
          <SectionLabel
            number="2"
            title="Time-Sink Breakdown"
            sub="Switch between Task · App · Department. Click a department bar to filter the entire dashboard."
          />
          <TimeSinkChart
            recoverable={{ ...(metrics?.recoverable ?? {}), byApp: metrics?.byApp ?? [] }}
            recoverableInr={metrics?.recoverableInr ?? null}
            activeDept={activeDeptFilter}
            activeTask={activeTaskFilter}
            onDeptClick={handleDeptClick}
            onTaskClick={handleTaskClick}
            loading={loading}
          />
        </section>

        {/* ════════════════════════════════════════════════════════════════
            SECTION 3 — Automation-priority ranking
            Cross-filter 2: clicking a task row filters the employee drilldown
        ════════════════════════════════════════════════════════════════ */}
        <section>
          <SectionLabel
            number="3"
            title="Automation-Priority Ranking"
            sub="Composite score: INR impact (35%) · repetitiveness (30%) · employee breadth (20%) · volume (15%). Click a row to filter employees below."
          />
          <PriorityTable
            items={prioritized}
            activeTask={activeTaskFilter}
            onTaskClick={handleTaskClick}
          />
        </section>

        {/* ════════════════════════════════════════════════════════════════
            SECTION 4 — Per-employee drill-down
            Filtered by task cross-filter when active
        ════════════════════════════════════════════════════════════════ */}
        <section>
          <SectionLabel
            number="4"
            title="Per-Employee Drill-Down"
            sub={
              activeTaskFilter
                ? `Showing employees with "${activeTaskFilter}" in top repetitive tasks — click the task badge above to clear`
                : "Activity profile, top repetitive tasks, and peer comparison within the same role"
            }
          />
          <EmployeeDrilldown
            benchmarks={filteredBenchmarks}
            taskFilter={activeTaskFilter}
          />
        </section>

        {/* ════════════════════════════════════════════════════════════════
            SECTION 5 — Week-over-week trend
        ════════════════════════════════════════════════════════════════ */}
        <section>
          <SectionLabel
            number="5"
            title="Week-over-Week Trend"
            sub="Repetitive workload % across 4 weeks — how things changed"
          />
          <TrendsSection weekOverWeek={metrics?.weekOverWeek ?? null} />
        </section>

        {/* ════════════════════════════════════════════════════════════════
            SECTION 6 — Anomaly callout
        ════════════════════════════════════════════════════════════════ */}
        <section>
          <SectionLabel
            number="6"
            title="Anomaly Callout"
            sub="Outliers the COO should know about — deterministic thresholds, no ML"
          />
          <AnomalyCallout anomalies={anomalies} loading={loading} />
        </section>

        {/* ════════════════════════════════════════════════════════════════
            SIDEBAR ROW — AI assistant + data quality
        ════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <AssistantPanel activeFilters={activeFilters} />
          </div>
          <div>
            <DataQualityPanel
              qualityReport={metrics?.qualityReport}
              meta={metrics?.meta}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
