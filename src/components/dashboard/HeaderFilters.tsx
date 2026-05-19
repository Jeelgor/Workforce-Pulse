"use client";
import * as React from "react";

export default function HeaderFilters({
  departments,
  onApply,
}: {
  departments: string[];
  onApply: (f: { startDate?: string; endDate?: string; department?: string }) => void;
}) {
  const [startDate, setStartDate] = React.useState<string>("");
  const [endDate, setEndDate] = React.useState<string>("");
  const [department, setDepartment] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);

  const handleApply = async () => {
    setSubmitting(true);
    await onApply({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      department: department || undefined,
    });
    setSubmitting(false);
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      {/* From date */}
      <div className="flex flex-col gap-0.5">
        <label
          htmlFor="filter-from"
          className="text-[10px] font-medium text-gray-500 uppercase tracking-wide"
        >
          From
        </label>
        <input
          id="filter-from"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="h-8 w-36 rounded-md border border-gray-200 bg-gray-50 px-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* To date */}
      <div className="flex flex-col gap-0.5">
        <label
          htmlFor="filter-to"
          className="text-[10px] font-medium text-gray-500 uppercase tracking-wide"
        >
          To
        </label>
        <input
          id="filter-to"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="h-8 w-36 rounded-md border border-gray-200 bg-gray-50 px-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Department */}
      <div className="flex flex-col gap-0.5">
        <label
          htmlFor="filter-dept"
          className="text-[10px] font-medium text-gray-500 uppercase tracking-wide"
        >
          Department
        </label>
        <select
          id="filter-dept"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="h-8 w-40 rounded-md border border-gray-200 bg-gray-50 px-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {/* Apply button */}
      <button
        onClick={handleApply}
        disabled={submitting}
        className="h-8 px-4 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
      >
        {submitting ? "Applying…" : "Apply"}
      </button>
    </div>
  );
}
