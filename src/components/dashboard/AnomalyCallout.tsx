"use client";
import * as React from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Anomaly {
  type: string;
  title: string;
  explanation: string;
  supportingMetrics: Record<string, number | string>;
  severity: "low" | "medium" | "high";
  employeeIds: string[];
  rowIndices: number[];
}

// ── Severity config ───────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  high: {
    bar:    "bg-red-500",
    badge:  "bg-red-50 text-red-700 border-red-200",
    icon:   "text-red-500",
    ring:   "ring-red-100",
    label:  "HIGH",
  },
  medium: {
    bar:    "bg-amber-400",
    badge:  "bg-amber-50 text-amber-700 border-amber-200",
    icon:   "text-amber-500",
    ring:   "ring-amber-100",
    label:  "MEDIUM",
  },
  low: {
    bar:    "bg-blue-400",
    badge:  "bg-blue-50 text-blue-700 border-blue-200",
    icon:   "text-blue-500",
    ring:   "ring-blue-100",
    label:  "LOW",
  },
} as const;

// ── Anomaly type → human label ────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  high_repetitive_employee:    "High Repetitive Employee",
  high_repetitive_department:  "High Repetitive Department",
  extreme_task_concentration:  "Task Concentration",
  dept_task_concentration:     "Dept Task Concentration",
  outlier_duration:            "Outlier Duration",
};

// ── Single anomaly card ───────────────────────────────────────────────────────

function AnomalyCard({ anomaly, index }: { anomaly: Anomaly; index: number }) {
  const [expanded, setExpanded] = React.useState(false);
  const cfg = SEVERITY_CONFIG[anomaly.severity];
  const metrics = Object.entries(anomaly.supportingMetrics);

  return (
    <div className={`relative rounded-lg border bg-white shadow-sm overflow-hidden ring-1 ${cfg.ring}`}>
      {/* Left severity bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${cfg.bar}`} aria-hidden />

      <div className="pl-4 pr-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {/* Index */}
            <span className="shrink-0 mt-0.5 text-xs font-bold text-gray-400 w-5 text-right">
              {index + 1}
            </span>

            <div className="min-w-0">
              {/* Severity badge + type */}
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold tracking-wide ${cfg.badge}`}>
                  {cfg.label}
                </span>
                <span className="text-[11px] text-gray-400 font-medium">
                  {TYPE_LABEL[anomaly.type] ?? anomaly.type}
                </span>
              </div>

              {/* Title */}
              <p className="text-sm font-semibold text-gray-900 leading-snug">
                {anomaly.title}
              </p>

              {/* Explanation */}
              <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                {anomaly.explanation}
              </p>
            </div>
          </div>

          {/* Expand toggle */}
          {metrics.length > 0 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? "Hide metrics" : "Show metrics"}
              className="shrink-0 mt-0.5 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>

        {/* Supporting metrics — expandable */}
        {expanded && metrics.length > 0 && (
          <div className="mt-3 ml-8 flex flex-wrap gap-2">
            {metrics.map(([key, val]) => (
              <div
                key={key}
                className="rounded-md bg-gray-50 border border-gray-100 px-2.5 py-1.5 text-xs"
              >
                <span className="text-gray-500">{key}: </span>
                <span className="font-semibold text-gray-800">{String(val)}</span>
              </div>
            ))}
            {anomaly.employeeIds.length > 0 && (
              <div className="rounded-md bg-gray-50 border border-gray-100 px-2.5 py-1.5 text-xs">
                <span className="text-gray-500">employees: </span>
                <span className="font-semibold text-gray-800">{anomaly.employeeIds.join(", ")}</span>
              </div>
            )}
            {anomaly.rowIndices.length > 0 && (
              <div className="rounded-md bg-gray-50 border border-gray-100 px-2.5 py-1.5 text-xs">
                <span className="text-gray-500">source rows: </span>
                <span className="font-semibold text-gray-800">{anomaly.rowIndices.length} rows</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AnomalyCallout({
  anomalies,
  loading = false,
}: {
  anomalies: Anomaly[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  if (!anomalies || anomalies.length === 0) {
    return (
      <div className="rounded-lg border bg-white shadow-sm p-5 flex items-center gap-3">
        <svg className="w-5 h-5 text-green-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <p className="text-sm text-gray-600">No anomalies detected in the current dataset and filter selection.</p>
      </div>
    );
  }

  // Sort: high → medium → low
  const sorted = [...anomalies].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });

  // Summary counts
  const counts = sorted.reduce(
    (acc, a) => { acc[a.severity] = (acc[a.severity] ?? 0) + 1; return acc; },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
        {counts.high   && <span className="flex items-center gap-1.5 text-red-700"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{counts.high} high</span>}
        {counts.medium && <span className="flex items-center gap-1.5 text-amber-700"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />{counts.medium} medium</span>}
        {counts.low    && <span className="flex items-center gap-1.5 text-blue-700"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />{counts.low} low</span>}
        <span className="text-gray-400 ml-1">· click ▾ to see supporting metrics</span>
      </div>

      {/* Cards */}
      {sorted.map((anomaly, i) => (
        <AnomalyCard key={`${anomaly.type}-${i}`} anomaly={anomaly} index={i} />
      ))}
    </div>
  );
}
