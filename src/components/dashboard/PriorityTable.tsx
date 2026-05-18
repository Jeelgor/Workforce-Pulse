"use client";
import * as React from "react";
import { formatINR, formatScore } from "../../lib/utils/index";

export default function PriorityTable({ items }: { items: Array<any> }) {
  return (
    <div className="rounded-lg border bg-white shadow-sm p-2">
      <div className="flex items-center justify-between px-3 py-2 font-medium text-sm border-b">
        <div className="w-6">#</div>
        <div className="flex-1">Task Category</div>
        <div className="w-24 text-right">Score</div>
        <div className="w-24 text-right">Feasibility</div>
        <div className="w-28 text-right">Recoverable INR</div>
        <div className="w-28 text-right">Employees</div>
      </div>

      <div>
        {items.map((it: any, idx: number) => (
          <div key={it.taskCategory} className="flex items-center justify-between px-3 py-3">
            <div className="w-6 text-muted-foreground">{idx + 1}</div>
            <div className="flex-1 pr-4">
              <div className="font-medium">{it.taskCategory}</div>
              <div className="text-xs text-muted-foreground">{it.sessionCount} sessions • {it.employeeCount} employees</div>
            </div>
            <div className="w-24 text-right font-semibold">{formatScore(it.score)}</div>
            <div className="w-24 text-right">{it.automationFeasibility}</div>
            <div className="w-28 text-right">{formatINR(it.estimatedInrImpact ?? 0)}</div>
            <div className="w-28 text-right">{it.employeeCount}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
