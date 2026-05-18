"use client";
import * as React from "react";

function SeverityBadge({ level }: { level: "low" | "medium" | "high" }) {
  const styles = {
    low:    "bg-blue-50 text-blue-700 border-blue-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    high:   "bg-red-50 text-red-700 border-red-200",
  } as const;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border flex-shrink-0 ${styles[level]}`}>
      {level.toUpperCase()}
    </span>
  );
}

export default function InsightsSection({
  insights,
}: {
  insights: Array<{
    id: string;
    severity: "low" | "medium" | "high";
    title: string;
    summary: string;
    time?: string;
  }>;
}) {
  if (!insights || insights.length === 0) {
    return (
      <div className="rounded-lg border bg-white shadow-sm p-4">
        <p className="text-sm text-gray-500">No operational insights available.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-900">Insights & Anomalies</h3>
        <span className="text-xs text-gray-400">Recent</span>
      </div>

      <div className="divide-y divide-gray-50">
        {insights.map((item) => (
          <div key={item.id} className="py-3 flex items-start gap-3">
            {/* Badge — flex-shrink-0 prevents it from squishing on mobile */}
            <SeverityBadge level={item.severity} />

            {/* Content — min-w-0 allows text to truncate/wrap correctly */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 leading-snug">
                {item.title}
              </div>
              <div className="mt-0.5 text-sm text-gray-500 leading-snug">
                {item.summary}
              </div>
            </div>

            {/* Timestamp — hidden on very small screens to avoid overflow */}
            {item.time && (
              <span className="hidden sm:block text-xs text-gray-400 flex-shrink-0 pt-0.5">
                {item.time}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
