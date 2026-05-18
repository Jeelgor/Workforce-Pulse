"use client";
import * as React from "react";
import HeaderFilters from "./HeaderFilters";
import KPICard from "./KPICard";
import InsightsSection from "./InsightsSection";
import PriorityTable from "./PriorityTable";
import TrendsSection from "./TrendsSection";
import EmployeeDrilldown from "./EmployeeDrilldown";
import AssistantPanel from "@/components/ai/AssistantPanel";
import ExportButton from "@/components/export/ExportButton";
import type { ExportPayload } from "@/lib/export/pdf";

export default function DashboardShell({ initial }: { initial: any }) {
  const [metrics, setMetrics] = React.useState<any>(initial);
  const [loading, setLoading] = React.useState(false);
  // Track active filters so the assistant can scope its context
  const [activeFilters, setActiveFilters] = React.useState<{
    department?: string;
    startDate?: string;
    endDate?: string;
  }>({});

  const apply = React.useCallback(
    async (filters: { startDate?: string; endDate?: string; department?: string }) => {
      setActiveFilters(filters);
      setLoading(true);
      try {
        const res = await fetch("/api/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(filters),
        });
        if (res.ok) {
          const json = await res.json();
          setMetrics(json);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const recoverableHours = metrics?.recoverable?.totalRecoverableHours ?? "—";
  const recoverableInr = metrics?.recoverableInr?.totalRecoverableInr ?? "—";
  const prioritized = metrics?.automationPriority ?? [];
  const rowsMeta = `Rows ${metrics?.meta?.normalizedRows ?? "—"}`;
  const topScoreMeta = `Score ${prioritized[0]?.score ?? "—"}`;

  // Build the export payload from current metrics state
  const getExportPayload = React.useCallback((): ExportPayload | null => {
    if (!metrics?.recoverable || !metrics?.recoverableInr || !metrics?.qualityReport) {
      return null;
    }
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
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b bg-slate-50 sticky top-0 z-40 pt-2">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 truncate">
              Workforce Pulse
            </h1>
            <p className="text-sm text-gray-500 mt-0.5 hidden sm:block">
              Executive operations dashboard — actionable insights
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            <ExportButton getPayload={getExportPayload} />
            <HeaderFilters departments={metrics?.departments ?? []} onApply={apply} />
          </div>
        </header>

        {/* ── KPI row ────────────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KPICard
            title="Recoverable Hours"
            value={recoverableHours}
            description="Estimated recoverable hours via automation"
            meta={[rowsMeta]}
            icon="clock"
            loading={loading}
          />
          <KPICard
            title="Estimated Monthly INR"
            value={recoverableInr}
            description="Estimated monthly recoverable cost"
            meta={["Currency INR"]}
            icon="currency"
            loading={loading}
          />
          <KPICard
            title="Top Automation Priority"
            value={prioritized[0]?.taskCategory ?? "—"}
            description={prioritized[0] ? `Score ${prioritized[0].score} / 100` : undefined}
            meta={[topScoreMeta]}
            loading={loading}
          />
        </section>

        {/* ── Employee drilldown ─────────────────────────────────────────── */}
        <EmployeeDrilldown benchmarks={metrics?.employeeBenchmarks ?? []} />

        {/* ── Main content + sidebar ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: insights, trends, priority table */}
          <div className="lg:col-span-2 space-y-4">
            <InsightsSection
              insights={metrics?.insights ?? [
                {
                  id: "i1",
                  severity: "medium" as const,
                  title: "Recoverable hours spike",
                  summary: "Repetitive work increased week-over-week in Sales.",
                },
                {
                  id: "i2",
                  severity: "high" as const,
                  title: "Missing compensation data",
                  summary: "Some employees lack compensation data; INR estimates are partial.",
                },
              ]}
            />

            <TrendsSection weekOverWeek={metrics?.weekOverWeek ?? null} />

            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                Automation Priority — Top 5
              </h2>
              <PriorityTable items={prioritized} />
            </div>
          </div>

          {/* Right: AI assistant + data quality */}
          <aside className="space-y-4">
            {/* AI Assistant */}
            <AssistantPanel activeFilters={activeFilters} />

            {/* Data quality */}
            <div className="rounded-lg border bg-white shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Data Quality
              </h3>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Normalized rows</dt>
                  <dd className="font-medium">{metrics?.meta?.normalizedRows ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Total raw rows</dt>
                  <dd className="font-medium">{metrics?.meta?.totalRows ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Dropped rows</dt>
                  <dd className="font-medium">{metrics?.qualityReport?.droppedRows ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Duplicates removed</dt>
                  <dd className="font-medium">{metrics?.qualityReport?.duplicateRowsRemoved ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Outlier rows</dt>
                  <dd className="font-medium text-amber-600">{metrics?.qualityReport?.outlierRows ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Missing metadata</dt>
                  <dd className="font-medium text-red-600">
                    {metrics?.qualityReport?.employeesMissingMetadataCount ?? "—"}
                  </dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
