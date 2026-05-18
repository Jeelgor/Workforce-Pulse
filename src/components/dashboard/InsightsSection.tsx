"use client";
import * as React from "react";

function SeverityBadge({ level }: { level: "low" | "medium" | "high" }) {
  const map = {
    low: "bg-zinc-100 text-zinc-800 border-zinc-200",
    medium: "bg-amber-100 text-amber-800 border-amber-200",
    high: "bg-red-100 text-red-800 border-red-200",
  } as const;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${map[level]}`}>
      {level.toUpperCase()}
    </span>
  );
}

export default function InsightsSection({ insights }: { insights: Array<{ id: string; severity: "low"|"medium"|"high"; title: string; summary: string; time?: string; }> }) {
  if (!insights || insights.length === 0) {
    return (
      <div className="rounded-md border bg-muted/20 p-4">
        <div className="text-sm text-muted-foreground">No operational insights available</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-medium">Insights & Anomalies</h3>
        <div className="text-sm text-muted-foreground">Recent</div>
      </div>
      <div className="divide-y">
        {insights.map((i) => (
          <div key={i.id} className="flex items-start justify-between gap-4 py-3">
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-3">
                <SeverityBadge level={i.severity} />
                <div className="font-medium text-sm">{i.title}</div>
              </div>
              <div className="mt-1 text-sm text-muted-foreground leading-snug">{i.summary}</div>
            </div>
            <div className="text-sm text-muted-foreground">{i.time ?? "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
