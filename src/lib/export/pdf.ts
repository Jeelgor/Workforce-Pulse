// =============================================================================
// pdf.ts — One-page executive summary for Workforce Pulse
//
// Spec: "headline numbers, top-5 automation opportunities, and the date range
// covered. Generated from the live state of the filters."
// =============================================================================

import { jsPDF } from "jspdf";
import { formatHours } from "@/lib/utils/index";
import type {
  RecoverableHoursResult,
  RecoverableInrResult,
  AutomationPriorityItem,
  Anomaly,
} from "@/lib/data/analytics";
import type { DataQualityReport } from "@/lib/data/types";

// ---------------------------------------------------------------------------
// Payload — kept compatible with DashboardShell
// ---------------------------------------------------------------------------

export interface ExportPayload {
  generatedAt: string;
  filters: { department?: string; startDate?: string; endDate?: string };
  recoverable: RecoverableHoursResult;
  recoverableInr: RecoverableInrResult;
  automationPriority: AutomationPriorityItem[];
  employeeBenchmarks: unknown[];
  weekOverWeek: unknown | null;
  anomalies: Anomaly[];
  qualityReport: DataQualityReport;
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const PW = 210;
const PH = 297;
const ML = 16;
const MR = 16;
const CW = PW - ML - MR;

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

const BLUE   = [29,  78,  216] as const;
const DARK   = [17,  24,  39]  as const;
const MID    = [75,  85,  99]  as const;
const LIGHT  = [156, 163, 175] as const;
const BG     = [248, 249, 251] as const;
const RULE   = [229, 231, 235] as const;
const TH_BG  = [241, 245, 249] as const;
const ALT_BG = [249, 250, 251] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtINR(n: number): string {
  if (!Number.isFinite(n)) return "N/A";
  if (n >= 1_000_000) return `INR ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `INR ${(n / 1_000).toFixed(1)}K`;
  return `INR ${Math.round(n).toLocaleString("en-IN")}`;
}

function fmtHrs(h: number): string {
  return formatHours(h).replace(/[^\x00-\x7F]/g, "");
}

function ascii(s: string): string {
  return s.replace(/[\u2014\u2013]/g, " - ").replace(/[^\x00-\x7F]/g, "");
}

function sf(doc: jsPDF, size: number, bold = false) {
  doc.setFontSize(size);
  doc.setFont("helvetica", bold ? "bold" : "normal");
}

function sc(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function fillRect(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  rgb: readonly [number, number, number]
) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  doc.rect(x, y, w, h, "F");
}

function hline(doc: jsPDF, y: number) {
  doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
  doc.setLineWidth(0.25);
  doc.line(ML, y, PW - MR, y);
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function exportDashboardPDF(payload: ExportPayload): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  // ── Header banner ─────────────────────────────────────────────────────────
  fillRect(doc, 0, 0, PW, 42, BLUE);
  doc.setTextColor(255, 255, 255);

  sf(doc, 22, true);
  doc.text("Workforce Pulse", ML, 17);

  sf(doc, 10);
  doc.text("Executive Summary", ML, 26);

  // Date range line
  const d = new Date(payload.generatedAt);
  const genStr =
    d.toLocaleDateString("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit", month: "short", year: "numeric",
    }) +
    "  " +
    d.toLocaleTimeString("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit", minute: "2-digit",
    }) +
    " IST";

  const rangeParts: string[] = [];
  if (payload.filters.startDate || payload.filters.endDate) {
    const r = [payload.filters.startDate, payload.filters.endDate]
      .filter(Boolean).join(" to ");
    rangeParts.push(`Date range: ${r}`);
  } else {
    rangeParts.push("Date range: Oct 2025 (full dataset)");
  }
  if (payload.filters.department) {
    rangeParts.push(`Department: ${ascii(payload.filters.department)}`);
  }
  rangeParts.push(`Generated: ${genStr}`);

  // Generated timestamp in header
  sf(doc, 7.5);
  doc.text(`Generated: ${genStr}`, ML, 36);

  let y = 52;

  // ── Date range bar — prominent, clearly visible ───────────────────────────
  fillRect(doc, ML, y, CW, 10, [239, 246, 255] as const); // light blue bg
  doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.setLineWidth(0.4);
  doc.rect(ML, y, CW, 10);

  // Left: date range
  sf(doc, 8, true); sc(doc, BLUE);
  const rangeLabel = payload.filters.startDate || payload.filters.endDate
    ? `Date range: ${[payload.filters.startDate, payload.filters.endDate].filter(Boolean).join(" to ")}`
    : "Date range: Oct 2025 (full dataset — 4 weeks)";
  doc.text(rangeLabel, ML + 4, y + 6.5);

  // Right: department filter if active
  if (payload.filters.department) {
    sf(doc, 8, true); sc(doc, BLUE);
    doc.text(`Department: ${ascii(payload.filters.department)}`, PW - MR - 4, y + 6.5, { align: "right" });
  }

  y += 10 + 7;

  // ── Section bar helper ────────────────────────────────────────────────────
  function sectionBar(title: string) {
    fillRect(doc, ML, y, CW, 8, BLUE);
    doc.setTextColor(255, 255, 255);
    sf(doc, 9, true);
    doc.text(title.toUpperCase(), ML + 4, y + 5.6);
    y += 8 + 5;
    sc(doc, DARK);
  }

  // =========================================================================
  // 1. HEADLINE NUMBERS
  // =========================================================================
  sectionBar("Headline Numbers");

  const boxW = (CW - 6) / 3;
  const boxH = 28;

  const kpis = [
    {
      label: "Recoverable Hours / Month",
      value: fmtHrs(payload.recoverable.totalRecoverableHours),
      sub1: `${payload.recoverable.totalRepetitiveMinutes.toLocaleString()} repetitive min`,
      sub2: "after automation feasibility",
    },
    {
      label: "Recoverable Cost / Month",
      value: fmtINR(payload.recoverableInr.totalRecoverableInr),
      sub1: "Based on joined HRMS data",
      sub2: `${payload.recoverableInr.metadata.rowsSkippedNoCompensation} rows excluded (no comp.)`,
    },
    {
      label: "Top Automation Priority",
      value: ascii(payload.automationPriority[0]?.taskCategory ?? "N/A"),
      sub1: payload.automationPriority[0]
        ? `Score: ${payload.automationPriority[0].score} / 100`
        : "",
      sub2: payload.automationPriority[0]
        ? `${Math.round(payload.automationPriority[0].automationFeasibility * 100)}% automation feasibility`
        : "",
    },
  ];

  kpis.forEach((kpi, i) => {
    const x = ML + i * (boxW + 3);

    // Box
    fillRect(doc, x, y, boxW, boxH, BG);
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
    doc.setLineWidth(0.3);
    doc.rect(x, y, boxW, boxH);

    // Blue top accent bar
    fillRect(doc, x, y, boxW, 2, BLUE);

    // Label
    sf(doc, 7); sc(doc, MID);
    doc.text(ascii(kpi.label), x + 3, y + 7);

    // Value
    sf(doc, 15, true); sc(doc, DARK);
    const val = doc.splitTextToSize(kpi.value, boxW - 6)[0] as string;
    doc.text(val, x + 3, y + 17);

    // Sub lines
    sf(doc, 6.5); sc(doc, LIGHT);
    doc.text(ascii(kpi.sub1), x + 3, y + 22.5);
    if (kpi.sub2) doc.text(ascii(kpi.sub2), x + 3, y + 26.5);
  });

  y += boxH + 10;

  // =========================================================================
  // 2. TOP-5 AUTOMATION OPPORTUNITIES
  // =========================================================================
  sectionBar("Top-5 Automation Opportunities");

  // Formula note
  sf(doc, 7); sc(doc, MID);
  doc.text(
    "Score = INR impact (35%) + repetitiveness (30%) + employee breadth (20%) + volume (15%), normalised 0-100.",
    ML, y
  );
  y += 6;

  // Table
  const cols = [
    { label: "#",             w: 9,  align: "R" as const },
    { label: "Task Category", w: 55, align: "L" as const },
    { label: "Score",         w: 26, align: "R" as const },
    { label: "Feasibility",   w: 24, align: "R" as const },
    { label: "INR Impact",    w: 36, align: "R" as const },
    { label: "Employees",     w: 28, align: "R" as const },
  ];
  const rowH = 8.5;

  // Header
  fillRect(doc, ML, y, CW, rowH, TH_BG);
  sf(doc, 8, true); sc(doc, MID);
  let cx = ML;
  cols.forEach((col) => {
    const tx = col.align === "R" ? cx + col.w - 3 : cx + 3;
    doc.text(col.label, tx, y + rowH * 0.68, { align: col.align === "R" ? "right" : "left" });
    cx += col.w;
  });
  y += rowH;

  // Rows
  payload.automationPriority.slice(0, 5).forEach((item, ri) => {
    if (ri % 2 === 1) fillRect(doc, ML, y, CW, rowH, ALT_BG);
    sf(doc, 8); sc(doc, DARK);
    cx = ML;
    const cells = [
      String(ri + 1),
      ascii(item.taskCategory),
      `${item.score} / 100`,
      `${Math.round(item.automationFeasibility * 100)}%`,
      fmtINR(item.estimatedInrImpact),
      String(item.employeeCount),
    ];
    cells.forEach((cell, ci) => {
      const col = cols[ci];
      const tx = col.align === "R" ? cx + col.w - 3 : cx + 3;
      const truncated = doc.splitTextToSize(cell, col.w - 5)[0] as string;
      doc.text(truncated, tx, y + rowH * 0.68, { align: col.align === "R" ? "right" : "left" });
      cx += col.w;
    });
    y += rowH;
  });

  hline(doc, y);
  y += 10;

  // =========================================================================
  // Footer — just below content
  // =========================================================================
  hline(doc, y);
  sf(doc, 7); sc(doc, LIGHT);
  doc.text("Workforce Pulse  |  Confidential", ML, y + 5);
  doc.text("Page 1 of 1", PW - MR, y + 5, { align: "right" });

  // =========================================================================
  // Save
  // =========================================================================
  const dateStr = new Date().toISOString().slice(0, 10);
  const suffix = payload.filters.department
    ? `-${payload.filters.department.toLowerCase().replace(/\s+/g, "-")}`
    : "";
  doc.save(`workforce-pulse-summary${suffix}-${dateStr}.pdf`);
}
