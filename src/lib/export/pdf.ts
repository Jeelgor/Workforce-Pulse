// =============================================================================
// pdf.ts — Structured PDF export for Workforce Pulse
//
// Uses jsPDF to generate a multi-page report directly from analytics data.
// No DOM capture / html2canvas — the report is built programmatically so it
// renders cleanly at any resolution and works in all browsers.
// =============================================================================

import { jsPDF } from "jspdf";
import { formatINR, formatHours } from "@/lib/utils/index";
import type {
  RecoverableHoursResult,
  RecoverableInrResult,
  AutomationPriorityItem,
  EmployeeBenchmark,
  WeekOverWeekResult,
  Anomaly,
} from "@/lib/data/analytics";
import type { DataQualityReport } from "@/lib/data/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportPayload {
  generatedAt: string;
  filters: { department?: string; startDate?: string; endDate?: string };
  recoverable: RecoverableHoursResult;
  recoverableInr: RecoverableInrResult;
  automationPriority: AutomationPriorityItem[];
  employeeBenchmarks: EmployeeBenchmark[];
  weekOverWeek: WeekOverWeekResult | null;
  anomalies: Anomaly[];
  qualityReport: DataQualityReport;
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const PAGE_W = 210;   // A4 mm
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;
const LINE_H = 6;
const SECTION_GAP = 8;

// Brand colours (RGB)
const C_DARK   = [17,  24,  39]  as const;  // gray-900
const C_MID    = [75,  85,  99]  as const;  // gray-600
const C_LIGHT  = [156, 163, 175] as const;  // gray-400
const C_ACCENT = [29,  78,  216] as const;  // blue-700
const C_RED    = [220, 38,  38]  as const;  // red-600
const C_AMBER  = [217, 119, 6]   as const;  // amber-600
const C_GREEN  = [22,  163, 74]  as const;  // green-600
const C_BG     = [248, 249, 251] as const;  // slate-50

// ---------------------------------------------------------------------------
// Cursor helper — tracks Y position and auto-paginates
// ---------------------------------------------------------------------------

class Cursor {
  y: number;
  constructor(private doc: jsPDF, startY = MARGIN + 10) {
    this.y = startY;
  }

  /** Advance by `delta` mm; add a new page if needed */
  advance(delta: number) {
    this.y += delta;
    if (this.y > PAGE_H - MARGIN - 10) {
      this.doc.addPage();
      this.y = MARGIN + 6;
    }
  }

  /** Ensure at least `needed` mm remain on the page */
  ensureSpace(needed: number) {
    if (this.y + needed > PAGE_H - MARGIN - 10) {
      this.doc.addPage();
      this.y = MARGIN + 6;
    }
  }
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

function setFont(doc: jsPDF, size: number, style: "normal" | "bold" = "normal") {
  doc.setFontSize(size);
  doc.setFont("helvetica", style);
}

function setColor(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function drawHRule(doc: jsPDF, y: number, color: [number, number, number] = [...C_LIGHT]) {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
}

function drawFilledRect(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  rgb: readonly [number, number, number]
) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  doc.rect(x, y, w, h, "F");
}

/** Severity colour */
function severityColor(s: string): readonly [number, number, number] {
  if (s === "high")   return C_RED;
  if (s === "medium") return C_AMBER;
  return C_ACCENT;
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function sectionHeader(doc: jsPDF, cur: Cursor, title: string) {
  cur.ensureSpace(14);
  drawFilledRect(doc, MARGIN, cur.y, CONTENT_W, 7, C_ACCENT);
  doc.setTextColor(255, 255, 255);
  setFont(doc, 9, "bold");
  doc.text(title.toUpperCase(), MARGIN + 3, cur.y + 5);
  cur.advance(7 + 3);
  setColor(doc, C_DARK);
}

// ---------------------------------------------------------------------------
// KPI row (3 boxes side by side)
// ---------------------------------------------------------------------------

function kpiRow(
  doc: jsPDF,
  cur: Cursor,
  items: { label: string; value: string; sub?: string }[]
) {
  const boxW = (CONTENT_W - 4) / 3;
  const boxH = 18;
  cur.ensureSpace(boxH + 4);

  items.forEach((item, i) => {
    const x = MARGIN + i * (boxW + 2);
    drawFilledRect(doc, x, cur.y, boxW, boxH, C_BG);
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.rect(x, cur.y, boxW, boxH);

    setFont(doc, 7);
    setColor(doc, C_MID);
    doc.text(item.label, x + 3, cur.y + 5);

    setFont(doc, 11, "bold");
    setColor(doc, C_DARK);
    doc.text(item.value, x + 3, cur.y + 12);

    if (item.sub) {
      setFont(doc, 6.5);
      setColor(doc, C_LIGHT);
      doc.text(item.sub, x + 3, cur.y + 16.5);
    }
  });

  cur.advance(boxH + 4);
}

// ---------------------------------------------------------------------------
// Simple two-column table
// ---------------------------------------------------------------------------

function table(
  doc: jsPDF,
  cur: Cursor,
  headers: string[],
  rows: string[][],
  colWidths?: number[]
) {
  const widths = colWidths ?? headers.map(() => CONTENT_W / headers.length);
  const rowH = LINE_H;

  // Header row
  cur.ensureSpace(rowH + 2);
  drawFilledRect(doc, MARGIN, cur.y, CONTENT_W, rowH, [241, 245, 249]);
  setFont(doc, 7.5, "bold");
  setColor(doc, C_MID);
  let x = MARGIN + 2;
  headers.forEach((h, i) => {
    doc.text(h, x, cur.y + 4.5);
    x += widths[i];
  });
  cur.advance(rowH);

  // Data rows
  rows.forEach((row, ri) => {
    cur.ensureSpace(rowH);
    if (ri % 2 === 1) {
      drawFilledRect(doc, MARGIN, cur.y, CONTENT_W, rowH, [249, 250, 251]);
    }
    setFont(doc, 7.5);
    setColor(doc, C_DARK);
    x = MARGIN + 2;
    row.forEach((cell, ci) => {
      const maxW = widths[ci] - 3;
      const truncated = doc.splitTextToSize(cell, maxW)[0] as string;
      doc.text(truncated, x, cur.y + 4.5);
      x += widths[ci];
    });
    cur.advance(rowH);
  });

  cur.advance(2);
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

export async function exportDashboardPDF(payload: ExportPayload): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const cur = new Cursor(doc, MARGIN);

  // ── Cover / title ─────────────────────────────────────────────────────────
  drawFilledRect(doc, 0, 0, PAGE_W, 42, C_ACCENT);

  doc.setTextColor(255, 255, 255);
  setFont(doc, 20, "bold");
  doc.text("Workforce Pulse", MARGIN, 18);

  setFont(doc, 10);
  doc.text("Executive Analytics Report", MARGIN, 26);

  setFont(doc, 8);
  const genDate = new Date(payload.generatedAt).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
  doc.text(`Generated: ${genDate} IST`, MARGIN, 33);

  if (payload.filters.department) {
    doc.text(`Filter: ${payload.filters.department}`, MARGIN + 80, 33);
  }

  cur.y = 50;

  // ── 1. Executive KPIs ─────────────────────────────────────────────────────
  sectionHeader(doc, cur, "1. Executive KPIs");

  kpiRow(doc, cur, [
    {
      label: "Recoverable Hours",
      value: formatHours(payload.recoverable.totalRecoverableHours),
      sub: `${payload.recoverable.totalRepetitiveMinutes} repetitive min`,
    },
    {
      label: "Recoverable INR / month",
      value: formatINR(payload.recoverableInr.totalRecoverableInr),
      sub: `${payload.recoverableInr.metadata.rowsSkippedNoCompensation} rows w/o comp.`,
    },
    {
      label: "Top Automation Priority",
      value: payload.automationPriority[0]?.taskCategory ?? "—",
      sub: `Score ${payload.automationPriority[0]?.score ?? "—"} / 100`,
    },
  ]);

  cur.advance(SECTION_GAP);

  // ── 2. Recoverable hours by department ────────────────────────────────────
  sectionHeader(doc, cur, "2. Recoverable Hours by Department");

  table(
    doc, cur,
    ["Department", "Rep. Minutes", "Rec. Minutes", "Rec. Hours"],
    payload.recoverable.byDepartment.map((d) => [
      d.department,
      d.repetitiveMinutes.toLocaleString(),
      d.recoverableMinutes.toLocaleString(),
      (d.recoverableMinutes / 60).toFixed(1),
    ]),
    [60, 40, 40, 42]
  );

  cur.advance(SECTION_GAP);

  // ── 3. Recoverable INR by department ──────────────────────────────────────
  sectionHeader(doc, cur, "3. Recoverable INR by Department");

  table(
    doc, cur,
    ["Department", "Rec. INR", "Employees"],
    payload.recoverableInr.byDepartment.map((d) => [
      d.department,
      `₹${d.recoverableInr.toLocaleString()}`,
      String(d.contributingEmployeeIds.length),
    ]),
    [80, 60, 42]
  );

  cur.advance(SECTION_GAP);

  // ── 4. Automation priority ranking ────────────────────────────────────────
  sectionHeader(doc, cur, "4. Automation Priority Ranking");

  table(
    doc, cur,
    ["#", "Task Category", "Score", "Feasibility", "INR Impact", "Employees"],
    payload.automationPriority.slice(0, 15).map((item, i) => [
      String(i + 1),
      item.taskCategory,
      `${item.score} / 100`,
      `${Math.round(item.automationFeasibility * 100)}%`,
      `₹${item.estimatedInrImpact.toLocaleString()}`,
      String(item.employeeCount),
    ]),
    [10, 52, 22, 24, 36, 24]
  );

  cur.advance(SECTION_GAP);

  // ── 5. Employee benchmarks ────────────────────────────────────────────────
  sectionHeader(doc, cur, "5. Employee Benchmarks");

  table(
    doc, cur,
    ["Employee", "Role", "Rep %", "Role Avg %", "Δ vs Avg", "Est. Cost INR"],
    payload.employeeBenchmarks.slice(0, 15).map((b) => {
      const delta = b.peerComparison.deltaFromRoleAvg;
      return [
        b.name,
        b.role,
        `${b.repetitivePercent}%`,
        `${b.peerComparison.roleAvgRepetitivePercent}%`,
        delta > 0 ? `+${delta} pp` : delta < 0 ? `${delta} pp` : "—",
        `₹${b.estimatedRepetitiveCostInr.toLocaleString()}`,
      ];
    }),
    [38, 38, 18, 22, 20, 36]
  );

  cur.advance(SECTION_GAP);

  // ── 6. Week-over-week trends ──────────────────────────────────────────────
  if (payload.weekOverWeek && payload.weekOverWeek.repetitiveWorkload.length > 0) {
    sectionHeader(doc, cur, "6. Week-over-Week Trends");

    table(
      doc, cur,
      ["Week", "Rep %", "Rep Min", "Total Min", "Sessions"],
      payload.weekOverWeek.repetitiveWorkload.map((w) => [
        w.week,
        `${w.repetitivePercent}%`,
        w.repetitiveMinutes.toLocaleString(),
        w.totalMinutes.toLocaleString(),
        String(w.sessionCount),
      ]),
      [36, 22, 32, 32, 24]
    );

    const ins = payload.weekOverWeek.insights;
    if (ins) {
      cur.ensureSpace(24);
      setFont(doc, 8, "bold");
      setColor(doc, C_DARK);
      doc.text("WoW Insights", MARGIN, cur.y);
      cur.advance(5);

      const insightLines: string[] = [];
      if (ins.largestRepetitiveIncrease) {
        insightLines.push(
          `▲ Largest spike: ${ins.largestRepetitiveIncrease.fromWeek} → ${ins.largestRepetitiveIncrease.toWeek} (+${ins.largestRepetitiveIncrease.deltaPercent} pp)`
        );
      }
      if (ins.largestRepetitiveDecrease) {
        insightLines.push(
          `▼ Largest drop: ${ins.largestRepetitiveDecrease.fromWeek} → ${ins.largestRepetitiveDecrease.toWeek} (${ins.largestRepetitiveDecrease.deltaPercent} pp)`
        );
      }
      if (ins.fastestGrowingTask) {
        insightLines.push(
          `📈 Fastest-growing task: ${ins.fastestGrowingTask.taskCategory} (+${ins.fastestGrowingTask.deltaMinutes} min)`
        );
      }
      if (ins.biggestDeptShift) {
        insightLines.push(
          `🏢 Biggest dept shift: ${ins.biggestDeptShift.department} ${ins.biggestDeptShift.direction === "increase" ? "+" : "-"}${ins.biggestDeptShift.deltaMinutes} min`
        );
      }

      setFont(doc, 8);
      setColor(doc, C_MID);
      insightLines.forEach((line) => {
        cur.ensureSpace(LINE_H);
        doc.text(line, MARGIN + 2, cur.y);
        cur.advance(LINE_H);
      });
    }

    cur.advance(SECTION_GAP);
  }

  // ── 7. Anomalies ──────────────────────────────────────────────────────────
  sectionHeader(doc, cur, "7. Anomalies & Alerts");

  if (payload.anomalies.length === 0) {
    setFont(doc, 8);
    setColor(doc, C_MID);
    doc.text("No anomalies detected.", MARGIN + 2, cur.y);
    cur.advance(LINE_H);
  } else {
    payload.anomalies.forEach((a) => {
      cur.ensureSpace(18);

      // Severity pill
      const sc = severityColor(a.severity);
      drawFilledRect(doc, MARGIN, cur.y, 18, 5.5, sc);
      doc.setTextColor(255, 255, 255);
      setFont(doc, 6.5, "bold");
      doc.text(a.severity.toUpperCase(), MARGIN + 1.5, cur.y + 4);

      // Title
      setFont(doc, 8, "bold");
      setColor(doc, C_DARK);
      doc.text(a.title, MARGIN + 21, cur.y + 4);
      cur.advance(7);

      // Explanation (wrapped)
      setFont(doc, 7.5);
      setColor(doc, C_MID);
      const wrapped = doc.splitTextToSize(a.explanation, CONTENT_W - 4) as string[];
      wrapped.forEach((line: string) => {
        cur.ensureSpace(LINE_H);
        doc.text(line, MARGIN + 2, cur.y);
        cur.advance(LINE_H - 1);
      });

      // Supporting metrics
      const metricsStr = Object.entries(a.supportingMetrics)
        .map(([k, v]) => `${k}: ${v}`)
        .join("  ·  ");
      setFont(doc, 7);
      setColor(doc, C_LIGHT);
      const mWrapped = doc.splitTextToSize(metricsStr, CONTENT_W - 4) as string[];
      mWrapped.forEach((line: string) => {
        cur.ensureSpace(LINE_H);
        doc.text(line, MARGIN + 2, cur.y);
        cur.advance(LINE_H - 1);
      });

      cur.advance(3);
      drawHRule(doc, cur.y, [229, 231, 235]);
      cur.advance(3);
    });
  }

  cur.advance(SECTION_GAP);

  // ── 8. Data quality ───────────────────────────────────────────────────────
  sectionHeader(doc, cur, "8. Data Quality");

  const qr = payload.qualityReport;
  table(
    doc, cur,
    ["Metric", "Value"],
    [
      ["Total raw rows",                  String(qr.totalRawRows)],
      ["Normalized rows",                 String(qr.normalizedRows)],
      ["Dropped rows",                    String(qr.droppedRows)],
      ["Fixed / corrected rows",          String(qr.fixedRows)],
      ["Flagged rows (zero / outlier)",   String(qr.flaggedRows)],
      ["Duplicate rows removed",          String(qr.duplicateRowsRemoved)],
      ["Outlier rows (>720 min)",         String(qr.outlierRows)],
      ["Duplicate employee conflicts",    String(qr.duplicateEmployeeConflicts)],
      ["Employees missing metadata",      `${qr.employeesMissingMetadataCount} (${qr.employeesMissingMetadata.join(", ") || "none"})`],
      ["Employees with no activity",      `${qr.metadataWithoutActivityCount}`],
    ],
    [100, 82]
  );

  // ── Footer on every page ──────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages() as number;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawHRule(doc, PAGE_H - 10);
    setFont(doc, 7);
    setColor(doc, C_LIGHT);
    doc.text("Workforce Pulse — Confidential", MARGIN, PAGE_H - 6);
    doc.text(
      `Page ${p} of ${totalPages}`,
      PAGE_W - MARGIN,
      PAGE_H - 6,
      { align: "right" }
    );
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const filename = `workforce-pulse-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
