"use client";
import * as React from "react";

export interface EmployeeBenchmark {
  employeeId: string;
  name: string;
  role: string;
  department: string;
  totalMinutes: number;
  sessionCount: number;
  repetitiveMinutes: number;
  repetitivePercent: number;
  topRepetitiveTasks: { taskCategory: string; minutes: number }[];
  estimatedRepetitiveCostInr: number;
  peerComparison: {
    roleAvgRepetitivePercent: number;
    deltaFromRoleAvg: number;
    peerCount: number;
  };
}

export default function EmployeeDrilldown({
  benchmarks,
  taskFilter,
}: {
  benchmarks: EmployeeBenchmark[];
  taskFilter?: string | null;
}) {
  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string>(benchmarks[0]?.employeeId ?? "");

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return benchmarks;
    return benchmarks.filter((item) =>
      `${item.name} ${item.role} ${item.department} ${item.employeeId}`.toLowerCase().includes(needle)
    );
  }, [benchmarks, query]);

  const selected = React.useMemo(() => {
    return (
      benchmarks.find((item) => item.employeeId === selectedId) ?? filtered[0] ?? benchmarks[0] ?? null
    );
  }, [benchmarks, filtered, selectedId]);

  const currentSelectValue = React.useMemo(() => {
    if (filtered.some((item) => item.employeeId === selectedId)) {
      return selectedId;
    }
    return filtered[0]?.employeeId ?? benchmarks[0]?.employeeId ?? "";
  }, [filtered, selectedId, benchmarks]);

  if (!benchmarks || benchmarks.length === 0) {
    return (
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Employee Drilldown</h2>
        {taskFilter && (
          <p className="text-xs text-purple-600 mt-1">Filtered by task: <strong>{taskFilter}</strong></p>
        )}
        <p className="text-sm text-muted-foreground mt-2">
          {taskFilter
            ? `No employees found with "${taskFilter}" in their top repetitive tasks.`
            : "No employee benchmark data is available for this filter selection."}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Employee Drilldown</h2>
          {taskFilter ? (
            <p className="text-xs text-purple-600 mt-1">
              Showing {benchmarks.length} employee{benchmarks.length !== 1 ? "s" : ""} with <strong>{taskFilter}</strong> in top repetitive tasks
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">Search an employee and compare repetitive workload to peers in the same role.</p>
          )}
        </div>

        <div className="w-full max-w-xl sm:w-80">
          <label htmlFor="employee-search" className="block text-xs font-medium text-slate-500 mb-2">
            Employee search
          </label>
          <input
            id="employee-search"
            className="w-full rounded-t-md border border-slate-200 border-b-0 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="Search by name, role, department"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            className="w-full rounded-b-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            aria-label="Select employee from search results"
            value={currentSelectValue}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {filtered.map((item) => (
              <option key={item.employeeId} value={item.employeeId}>
                {item.name} ({item.employeeId}) · {item.role}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selected && (
        <div className="mt-5 grid gap-4 xl:grid-cols-[1.4fr_0.85fr]">
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-sm text-slate-500">Selected employee</div>
                  <div className="text-xl font-semibold text-slate-900">{selected.name}</div>
                  <div className="text-sm text-slate-600">{selected.role} · {selected.department}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 text-center">
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Total mins</div>
                    <div className="mt-2 font-semibold text-slate-900">{selected.totalMinutes.toLocaleString()}</div>
                  </div>
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Sessions</div>
                    <div className="mt-2 font-semibold text-slate-900">{selected.sessionCount}</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-white p-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Repetitive mins</div>
                    <div className="mt-2 text-base font-semibold text-slate-900">{selected.repetitiveMinutes.toLocaleString()}</div>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Repetitive cost</div>
                    <div className="mt-2 text-base font-semibold text-slate-900">₹{selected.estimatedRepetitiveCostInr.toLocaleString()}</div>
                  </div>
                </div>

                <div className="rounded-lg bg-white p-3">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500">
                    <span>Repetitive workload</span>
                    <span>{selected.repetitivePercent.toFixed(1)}%</span>
                  </div>
                  <div className="mt-2 h-3 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-sky-600 transition-all duration-300"
                      style={{ width: `${Math.min(100, selected.repetitivePercent)}%` }}
                    />
                  </div>
                  <div className="mt-2 text-xs text-slate-500">Role average: {selected.peerComparison.roleAvgRepetitivePercent.toFixed(1)}%</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Top repetitive tasks</div>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {selected.topRepetitiveTasks.length > 0 ? (
                  selected.topRepetitiveTasks.map((task) => (
                    <div key={task.taskCategory} className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                      <span>{task.taskCategory}</span>
                      <span className="font-semibold">{task.minutes.toLocaleString()} min</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500">No repetitive tasks recorded.</div>
                )}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Benchmark insight</div>
              <div className="mt-3 text-xl font-semibold text-slate-900">
                {selected.peerComparison.deltaFromRoleAvg >= 0 ? "Above role average" : "Below role average"}
              </div>
              <div className="mt-2 text-sm text-slate-600">
                {Math.abs(selected.peerComparison.deltaFromRoleAvg).toFixed(1)} pp {selected.peerComparison.deltaFromRoleAvg >= 0 ? "higher" : "lower"} than peers in {selected.role}.
              </div>
              <div className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-700">
                {selected.peerComparison.peerCount > 0
                  ? `${selected.peerComparison.peerCount} peer${selected.peerComparison.peerCount !== 1 ? "s" : ""} in this role.`
                  : "Insufficient peer group data for role benchmarking."}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-500">Operational summary</div>
              <div className="mt-2 text-sm text-slate-700 space-y-2">
                <p>{selected.name} has {selected.repetitivePercent.toFixed(1)}% of recorded time categorized as repetitive.</p>
                <p>{selected.estimatedRepetitiveCostInr > 0 ? `Estimated repetitive cost is ₹${selected.estimatedRepetitiveCostInr.toLocaleString()}.` : "Repetitive cost estimate unavailable due to missing compensation data."}</p>
                <p>{selected.topRepetitiveTasks.length > 0 ? "Top repetitive tasks are highlighted below for further operational review." : "Task-specific repetition is not currently available."}</p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
