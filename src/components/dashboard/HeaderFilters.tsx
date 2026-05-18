"use client";
import * as React from "react";

export default function HeaderFilters({ departments, onApply }: { departments: string[]; onApply: (f: { startDate?: string; endDate?: string; department?: string }) => void; }) {
  const [startDate, setStartDate] = React.useState<string | undefined>(undefined);
  const [endDate, setEndDate] = React.useState<string | undefined>(undefined);
  const [department, setDepartment] = React.useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = React.useState(false);

  return (
    <div className="sticky top-4 z-30 flex items-center gap-3 bg-white/50 backdrop-blur-sm border rounded-md p-2">
      <div className="flex items-center gap-2">
        <label htmlFor="startDate" className="text-xs text-muted-foreground">From</label>
        <input id="startDate" aria-label="start date" className="input input-sm" type="date" value={startDate ?? ""} onChange={(e) => setStartDate(e.target.value || undefined)} />
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="endDate" className="text-xs text-muted-foreground">To</label>
        <input id="endDate" aria-label="end date" className="input input-sm" type="date" value={endDate ?? ""} onChange={(e) => setEndDate(e.target.value || undefined)} />
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="dept" className="text-xs text-muted-foreground">Dept</label>
        <select id="dept" aria-label="department" className="select select-sm" value={department ?? ""} onChange={(e) => setDepartment(e.target.value || undefined)}>
          <option value="">All</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>
      <div>
        <button className="btn btn-sm" disabled={submitting} onClick={async () => {
          setSubmitting(true);
          await onApply({ startDate, endDate, department });
          setSubmitting(false);
        }}>
          {submitting ? "Applying…" : "Apply"}
        </button>
      </div>
    </div>
  );
}
