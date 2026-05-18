"use client";
import * as React from "react";
import type { ExportPayload } from "@/lib/export/pdf";

type ExportState = "idle" | "loading" | "error";

export default function ExportButton({
  getPayload,
}: {
  /** Called when the user clicks — should return the current dashboard data */
  getPayload: () => ExportPayload | null;
}) {
  const [state, setState] = React.useState<ExportState>("idle");
  const [errorMsg, setErrorMsg] = React.useState("");

  const handleExport = async () => {
    if (state === "loading") return;

    const payload = getPayload();
    if (!payload) {
      setErrorMsg("No data available to export.");
      setState("error");
      setTimeout(() => setState("idle"), 3000);
      return;
    }

    setState("loading");
    setErrorMsg("");

    try {
      // Dynamic import keeps jsPDF out of the initial JS bundle
      const { exportDashboardPDF } = await import("@/lib/export/pdf");
      await exportDashboardPDF(payload);
      setState("idle");
    } catch (err) {
      console.error("[ExportButton] PDF generation failed:", err);
      setErrorMsg("Export failed. Please try again.");
      setState("error");
      setTimeout(() => setState("idle"), 4000);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleExport}
        disabled={state === "loading"}
        aria-label="Export dashboard as PDF"
        className={`
          inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium
          border transition-colors
          ${state === "error"
            ? "border-red-300 bg-red-50 text-red-700"
            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300"
          }
          disabled:opacity-60 disabled:cursor-not-allowed
        `}
      >
        {state === "loading" ? (
          <>
            <svg
              className="w-4 h-4 animate-spin text-gray-500"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            Generating…
          </>
        ) : state === "error" ? (
          <>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeWidth="2" strokeLinecap="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            {errorMsg || "Error"}
          </>
        ) : (
          <>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a1 1 0 001 1h16a1 1 0 001-1v-3" />
            </svg>
            Export PDF
          </>
        )}
      </button>
    </div>
  );
}
