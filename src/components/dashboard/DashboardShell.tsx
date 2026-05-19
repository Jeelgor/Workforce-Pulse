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

// ── Mobile assistant drawer ───────────────────────────────────────────────────
// Full-screen sheet on mobile. A sticky bar at the bottom triggers it.
function MobileAssistantDrawer({
  activeFilters,
}: {
  activeFilters: { department?: string; startDate?: string; endDate?: string };
}) {
  const [open, setOpen] = React.useState(false);

  // Prevent body scroll when sheet is open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Trigger bar — always visible at bottom on mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-white shadow-lg">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3"
          aria-expanded={open}
          aria-label={open ? "Close assistant" : "Open assistant"}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" aria-hidden />
            <span className="text-sm font-semibold text-gray-900">Workforce Pulse Assistant</span>
          </div>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            viewBox="0 0 20 20" fill="currentColor"
          >
            <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Full-screen sheet overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-white">
          {/* Sheet header with close button */}
          <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 bg-white">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" aria-hidden />
              <span className="text-sm font-semibold text-gray-900">Workforce Pulse Assistant</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          {/* Panel fills remaining screen height */}
          <div className="flex-1 min-h-0">
            <AssistantPanel activeFilters={activeFilters} fullHeight />
          </div>
        </div>
      )}

      {/* Bottom padding so content isn't hidden behind the trigger bar */}
      <div className="lg:hidden h-14" aria-hidden />
    </>
  );
}

// ── Main shell ────────────────────────────────────────────────────────────────
export default function DashboardShell({ initial }: { initial: any }) {
  const [metrics, setMetrics] = React.useState<any>(initial);
  const [loading, setLoading] = React.useState(false);

  const [activeFilters, setActiveFilters] = React.useState<{
    department?: string;
    startDate?: string;
    endDate?: string;
  }>({});

  const [activeDeptFilter, setActiveDeptFilter] = React.useState<string | null>(null);
  const [activeTaskFilter, setActiveTaskFilter] = React.useState<string | null>(null);

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

  const handleTaskClick = React.useCallback((task: string) => {
    setActiveTaskFilter((prev) => (prev === task ? null : task));
  }, []);

  const prioritized = metrics?.automationPriority ?? [];

  const anomalies: any[] = React.useMemo(
    () => metrics?.anomalies ?? [],
    [metrics?.anomalies]
  );

  const filteredBenchmarks = React.useMemo(() => {
    const all: any[] = metrics?.employeeBenchmarks ?? [];
    if (!activeTaskFilter) return all;
    return all.filter((b: any) =>
      b.topRepetitiveTasks?.some((t: any) => t.taskCategory === activeTaskFilter)
    );
  }, [metrics?.employeeBenchmarks, activeTaskFilter]);

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
    // Outer wrapper: on lg+ we use a side-by-side layout
    // Left: scrollable dashboard content  Right: sticky assistant panel
    <div className="min-h-screen bg-slate-50">

      {/* ── Desktop layout: content + sticky right panel ─────────────── */}
      <div className="lg:flex lg:items-start">

        {/* ── Scrollable main content ─────────────────────────────────── */}
        <div className="flex-1 min-w-0 overflow-x-hidden">
          <div className="max-w-4xl mx-auto px-4 md:px-6 py-4 md:py-6 space-y-8">

            {/* HEADER */}
            <header className="bg-slate-50 sticky top-0 z-40 pt-2 pb-3 border-b space-y-2">
              {/* Row 1: title + export */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 whitespace-nowrap">
                    Workforce Pulse
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                    Executive operations dashboard · where are we wasting the most time and money?
                  </p>
                </div>
                <ExportButton getPayload={getExportPayload} />
              </div>
              {/* Row 2: filters — full width, wraps naturally */}
              <div className="w-full overflow-x-auto">
                <HeaderFilters departments={metrics?.departments ?? []} onApply={apply} />
              </div>
            </header>

            {/* Cross-filter badges */}
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

            {/* SECTION 1 — Headline Numbers */}
            <section>
              <SectionLabel number="1" title="Headline Numbers"
                sub="Hours and cost recoverable through automation — based on joined HRMS compensation data" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <KPICard
                  title="Recoverable Hours / Month"
                  value={metrics?.recoverable?.totalRecoverableHours ?? "—"}
                  description={metrics?.recoverable?.totalRepetitiveMinutes
                    ? `${metrics.recoverable.totalRepetitiveMinutes.toLocaleString()} repetitive min × automation feasibility`
                    : "Repetitive hours recoverable through automation"}
                  meta={[`${metrics?.meta?.normalizedRows ?? "—"} normalized rows`]}
                  icon="clock" loading={loading}
                />
                <KPICard
                  title="Recoverable INR / Month"
                  value={metrics?.recoverableInr?.totalRecoverableInr ?? "—"}
                  description={metrics?.recoverableInr?.metadata?.rowsSkippedNoCompensation !== undefined
                    ? `${metrics.recoverableInr.metadata.rowsSkippedNoCompensation} rows excluded (no compensation data)`
                    : "Estimated monthly cost recoverable"}
                  meta={["Joined HRMS data · click ⓘ for formula"]}
                  icon="currency" loading={loading}
                  methodologySlot={<InrMethodologyTooltip />}
                />
              </div>
            </section>

            {/* SECTION 2 — Time-Sink Breakdown */}
            <section>
              <SectionLabel number="2" title="Time-Sink Breakdown"
                sub="Switch between Task · App · Department. Click a department bar to filter the entire dashboard." />
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

            {/* SECTION 3 — Automation-Priority Ranking */}
            <section>
              <SectionLabel number="3" title="Automation-Priority Ranking"
                sub="Composite score: INR impact (35%) · repetitiveness (30%) · employee breadth (20%) · volume (15%). Click a row to filter employees below." />
              <PriorityTable
                items={prioritized}
                activeTask={activeTaskFilter}
                onTaskClick={handleTaskClick}
              />
            </section>

            {/* SECTION 4 — Per-Employee Drill-Down */}
            <section>
              <SectionLabel number="4" title="Per-Employee Drill-Down"
                sub={activeTaskFilter
                  ? `Showing employees with "${activeTaskFilter}" in top repetitive tasks — click the task badge above to clear`
                  : "Activity profile, top repetitive tasks, and peer comparison within the same role"} />
              <EmployeeDrilldown benchmarks={filteredBenchmarks} taskFilter={activeTaskFilter} />
            </section>

            {/* SECTION 5 — Week-over-Week Trend */}
            <section>
              <SectionLabel number="5" title="Week-over-Week Trend"
                sub="Repetitive workload % across 4 weeks — how things changed" />
              <TrendsSection weekOverWeek={metrics?.weekOverWeek ?? null} />
            </section>

            {/* SECTION 6 — Anomaly Callout */}
            <section>
              <SectionLabel number="6" title="Anomaly Callout"
                sub="Outliers the COO should know about — deterministic thresholds, no ML" />
              <AnomalyCallout anomalies={anomalies} loading={loading} />
            </section>

            {/* Data quality strip — required by spec (rows dropped/fixed/flagged, missing metadata) */}
            {metrics?.qualityReport && (
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500 -mt-4 pb-2 border-b">
                <span>Raw: <strong className="text-gray-700">{metrics.meta?.totalRows ?? "—"}</strong></span>
                <span>Normalized: <strong className="text-gray-700">{metrics.meta?.normalizedRows ?? "—"}</strong></span>
                <span>Dropped: <strong className="text-gray-700">{metrics.qualityReport.droppedRows ?? "—"}</strong></span>
                <span>Fixed: <strong className="text-gray-700">{metrics.qualityReport.fixedRows ?? "—"}</strong></span>
                <span>Outliers: <strong className="text-amber-600">{metrics.qualityReport.outlierRows ?? "—"}</strong></span>
                <span>Missing metadata: <strong className="text-red-600">{metrics.qualityReport.employeesMissingMetadataCount ?? "—"}{metrics.qualityReport.employeesMissingMetadata?.length ? ` (${metrics.qualityReport.employeesMissingMetadata.join(", ")})` : ""}</strong></span>
                <span>No activity: <strong className="text-gray-700">{metrics.qualityReport.metadataWithoutActivityCount ?? "—"}</strong></span>
                <span>Dup. conflicts: <strong className="text-amber-600">{metrics.qualityReport.duplicateEmployeeConflicts ?? "—"}</strong></span>
              </div>
            )}

            {/* Bottom padding on mobile so content clears the drawer trigger */}
            <div className="lg:hidden h-4" aria-hidden />

          </div>
        </div>

        {/* ── Desktop sticky assistant panel ──────────────────────────── */}
        {/* Hidden on mobile — mobile uses the bottom drawer instead      */}
        <aside
          className="hidden lg:flex flex-col shrink-0 w-80 xl:w-96"
          style={{ position: "sticky", top: 0, height: "100vh" }}
        >
          {/* Inner scroll container so the panel fills the viewport height */}
          <div className="flex flex-col h-full border-l bg-white">
            {/* Panel header */}
            <div className="px-4 py-3 border-b bg-white shrink-0">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                AI Assistant
              </p>
            </div>
            {/* AssistantPanel fills remaining height */}
            <div className="flex-1 min-h-0 p-3">
              <AssistantPanel
                activeFilters={activeFilters}
                fullHeight
              />
            </div>
          </div>
        </aside>

      </div>

      {/* ── Mobile bottom drawer ─────────────────────────────────────── */}
      <MobileAssistantDrawer activeFilters={activeFilters} />

    </div>
  );
}
  