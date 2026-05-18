"use client";
import * as React from "react";
import { formatINR, formatScore } from "@/lib/utils/index";

export default function PriorityTable({ items }: { items: Array<any> }) {
  if (!items || items.length === 0) {
    return (
      <div className="rounded-lg border bg-white shadow-sm p-4 text-sm text-gray-500">
        No automation priority data available.
      </div>
    );
  }

  return (
    /* Horizontal scroll wrapper — prevents overflow on narrow viewports */
    <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs text-gray-500 font-medium">
              <th className="px-3 py-2.5 text-left w-8">#</th>
              <th className="px-3 py-2.5 text-left">Task Category</th>
              <th className="px-3 py-2.5 text-right w-20">Score</th>
              <th className="px-3 py-2.5 text-right w-24">Feasibility</th>
              <th className="px-3 py-2.5 text-right w-32">Recoverable INR</th>
              <th className="px-3 py-2.5 text-right w-24">Employees</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((it: any, idx: number) => (
              <tr key={it.taskCategory ?? idx} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-3 text-gray-400 text-xs">{idx + 1}</td>
                <td className="px-3 py-3">
                  <div className="font-medium text-gray-900">{it.taskCategory}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {it.sessionCount} sessions · {it.employeeCount} employees
                  </div>
                </td>
                <td className="px-3 py-3 text-right font-semibold text-gray-900">
                  {formatScore(it.score)}
                </td>
                <td className="px-3 py-3 text-right text-gray-600">
                  {Math.round((it.automationFeasibility ?? 0) * 100)}%
                </td>
                <td className="px-3 py-3 text-right text-gray-700">
                  {formatINR(it.estimatedInrImpact ?? 0)}
                </td>
                <td className="px-3 py-3 text-right text-gray-600">
                  {it.employeeCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
