// =============================================================================
// pdf.ts — Structured PDF export for Workforce Pulse
//
// Uses jsPDF to generate a multi-page A4 report directly from analytics data.
// No DOM capture — built programmatically for clean rendering at any resolution.
//
// Typography rules:
//  - Helvetica only (built-in, no font embedding needed)
//  - All text is ASCII-safe: no Unicode symbols, no emojis, no special glyphs
//  - INR values use "INR" prefix, not the Rupee sign (not in Helvetica)
//  - Arrows use ASCII: "^" up, "v" down, "->" direction
//  - Em-dashes replaced with " - " or "N/A"
// =============================================================================

import { jsPDF } from "jspdf";
import { formatHours } from "@/lib/utils/index";
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

const PAGE_W    = 210;              // A4 width mm
const PAGE_H    = 297;              // A4 height mm
const MARGIN    = 14;               // left/right margin mm
const CONTENT_W = PAGE_W - MARGIN * 2;
const ROW_H     = 7;                // table row height mm (comfortable reading)
const SECTION_GAP = 6;             // vertical gap between sections mm

// ---------------------------------------------------------------------------
// Colour palette (RGB tuples)
// ---------------------------------------------------------------------------

const C_DARK   = [17,  24,  39]  as const;  // gray-900  — body text
const C_MID    = [75,  85,  99]  as const;  // gray-600  — secondary text
const C_LIGHT  = [156, 163, 175] as const;  // gray-400  — captions / rules
const C_ACCENT = [29,  78,  216] as const;  // blue-700  — section headers
const C_RED    = [185, 28,  28]  as const;  // red-700   — high severity
const C_AMBER  = [180, 83,  9]   as const;  // amber-800 — medium severity
const C_BLUE   = [29,  78,  216] as const;  // blue-700  — low severity
const C_BG     = [248, 249, 251] as const;  // slate-50  — KPI box bg
const C_TH_BG  = [241, 245, 249] as const;  // slate-100 — table header bg
const C_ALT_BG = [249, 250, 251] as const;  // gray-50   — alternating row bg
const C_RULE   = [229, 231, 235] as const;  // gray-200  — divider lines

// ---------------------------------------------------------------------------
// ASCII-safe formatters
// ---------------------------------------------------------------------------

/** Format INR without the Rupee glyph — safe for Helvetica */
function fmtINR(amount: number): string {
  if (!Number.isFinite(amount)) return "N/A";
  if (amount >= 1_000_000) return `INR ${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000)     return `INR ${(amount / 1_000).toFixed(1)}K`;
  return `INR ${Math.round(amount).toLocaleString("en-IN")}`;
}

/** Format hours — ASCII safe */
function fmtHours(h: number): string {
  return formatHours(h).replace(/[^\x00-\x7F]/g, "");  // strip any non-ASCII
}

/** Replace any non-ASCII characters with safe equivalents */
function ascii(s: string): string {
  return s
    .replace(/[\u2014\u2013]/g, " - ")   // em/en dash -> " - "
    .replace(/[\u2192\u2794]/g, "->")    // arrows -> "->"
    .replace(/[\u25B2\u25B4]/g, "^")     // up triangles -> "^"
    .replace(/[\u25BC\u25BE]/g, "v")     // down triangles -> "v"
    .replace(/[\u0394]/g, "D")           // Delta -> "D"
    .replace(/[\u00B7\u2022\u2027]/g, ".") // middle dots -> "."
    .replace(/[^\x00-\x7F]/g, "");       // strip remaining non-ASCII
}

/** Fallback for null/undefined display values */
function orNA(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "" || v === "—") return "N/A";
  return ascii(String(v));
}

// ---------------------------------------------------------------------------
// Cursor — tracks Y and auto-paginates
// ---------------------------------------------------------------------------

class Cursor {
  y: number;
  constructor(private doc: jsPDF, startY = MARGIN + 10) {
    this.y = startY;
  }

  advance(delta: number) {
    this.y += delta;
    if (this.y > PAGE_H - MARGIN - 12) {
      this.doc.addPage();
      this.y = MARGIN + 8;
    }
  }

  ensureSpace(needed: number) {
    if (this.y + needed > PAGE_H - MARGIN - 12) {
      this.doc.addPage();
      this.y = MARGIN + 8;
    }
  }
}

// ---------------------------------------------------------------------------
// Drawing primitives
// ---------------------------------------------------------------------------

function setFont(doc: jsPDF, size: number, style: "normal" | "bold" = "normal") {
  doc.setFontSize(size);
  doc.setFont("helvetica", style);
}

function setColor(doc: jsPDF, rgb: readonly [number, number, number]) {
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

function hRule(doc: jsPDF, y: number, rgb: readonly [number, number, number] = C_RULE) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  doc.setLineWidth(0.25);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
}

// ---------------------------------------------------------------------------
// Section header — blue bar with white uppercase title
// ---------------------------------------------------------------------------

function sectionHeader(doc: jsPDF, cur: Cursor, title: string) {
  cur.ensureSpace(16);
  fillRect(doc, MARGIN, cur.y, CONTENT_W, 7.5, C_ACCENT);
  doc.setTextColor(255, 255, 255);
  setFont(doc, 8.5, "bold");
  doc.text(ascii(title).toUpperCase(), MARGIN + 3, cur.y + 5.2);
  cur.advance(7.5 + 4);
  setColor(doc, C_DARK);
}

// ---------------------------------------------------------------------------
// KPI row — 3 equal boxes
// ---------------------------------------------------------------------------

function kpiRow(
  doc: jsPDF,
  cur: Cursor,
  items: { label: string; value: string; sub?: string }[]
) {
  const gap  = 3;
  const boxW = (CONTENT_W - gap * 2) / 3;
  const boxH = 20;
  cur.ensureSpace(boxH + 6);

  items.forEach((item, i) => {
    const x = MARGIN + i * (boxW + gap);

    // Box background + border
    fillRect(doc, x, cur.y, boxW, boxH, C_BG);
    doc.setDrawColor(C_RULE[0], C_RULE[1], C_RULE[2]);
    doc.setLineWidth(0.3);
    doc.rect(x, cur.y, boxW, boxH);

    // Label
    setFont(doc, 7);
    setColor(doc, C_MID);
    doc.text(ascii(item.label), x + 3, cur.y + 5.5);

    // Value — large bold
    setFont(doc, 12, "bold");
    setColor(doc, C_DARK);
    // Truncate if too wide
    const maxW = boxW - 6;
    const valText = doc.splitTextToSize(ascii(item.value), maxW)[0] as string;
    doc.text(valText, x + 3, cur.y + 13.5);

    // Sub-label
    if (item.sub) {
      setFont(doc, 6.5);
      setColor(doc, C_LIGHT);
      doc.text(ascii(item.sub), x + 3, cur.y + 18);
    }
  });

  cur.advance(boxH + 6);
}

// ---------------------------------------------------------------------------
// Table
//
// Alignment per column: "L" = left (default), "R" = right-aligned
// Right-alignment is used for numeric columns.
// ---------------------------------------------------------------------------

type ColAlign = "L" | "R";

function table(
  doc: jsPDF,
  cur: Cursor,
  headers: string[],
  rows: string[][],
  colWidths?: number[],
  colAligns?: ColAlign[]
) {
  const widths = colWidths ?? headers.map(() => CONTENT_W / headers.length);
  const aligns = colAligns ?? headers.map(() => "L" as ColAlign);

  // ── Header row ────────────────────────────────────────────────────────────
  cur.ensureSpace(ROW_H + 2);
  fillRect(doc, MARGIN, cur.y, CONTENT_W, ROW_H, C_TH_BG);
  setFont(doc, 7.5, "bold");
  setColor(doc, C_MID);

  let x = MARGIN;
  headers.forEach((h, i) => {
    const cellX = aligns[i] === "R"
      ? x + widths[i] - 3
      : x + 3;
    doc.text(ascii(h), cellX, cur.y + 4.8, {
      align: aligns[i] === "R" ? "right" : "left",
    });
    x += widths[i];
  });
  cur.advance(ROW_H);

  // ── Data rows ─────────────────────────────────────────────────────────────
  rows.forEach((row, ri) => {
    cur.ensureSpace(ROW_H);

    // Alternating row background
    if (ri % 2 === 1) {
      fillRect(doc, MARGIN, cur.y, CONTENT_W, ROW_H, C_ALT_BG);
    }

    setFont(doc, 7.5);
    setColor(doc, C_DARK);
    x = MARGIN;

    row.forEach((cell, ci) => {
      const maxW = widths[ci] - 5;
      const safeCell = ascii(cell);
      const truncated = doc.splitTextToSize(safeCell, maxW)[0] as string;
      const cellX = aligns[ci] === "R"
        ? x + widths[ci] - 3
        : x + 3;
      doc.text(truncated, cellX, cur.y + 4.8, {
        align: aligns[ci] === "R" ? "right" : "left",
      });
      x += widths[ci];
    });

    cur.advance(ROW_H);
  });

  // Bottom rule under table
  hRule(doc, cur.y);
  cur.advance(3);
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

export async function exportDashboardPDF(payload: ExportPayload): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const cur = new Cursor(doc, MARGIN);

  // ── Cover banner ──────────────────────────────────────────────────────────
  fillRect(doc, 0, 0, PAGE_W, 44, C_ACCENT);

  doc.setTextColor(255, 255, 255);
  setFont(doc, 22, "bold");
  doc.text("Workforce Pulse", MARGIN, 19);

  setFont(doc, 10);
  doc.text("Executive Analytics Report", MARGIN, 28);

  setFont(doc, 8);
  // Format date without locale-specific Unicode
  const d = new Date(payload.generatedAt);
  const genDate = d.toLocaleDateString("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
  }) + "  " + d.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit", minute: "2-digit",
  }) + " IST";
  doc.text(`Generated: ${genDate}`, MARGIN, 37);

  if (payload.filters.department) {
    doc.text(`Department filter: ${ascii(payload.filters.department)}`, MARGIN + 90, 37);
  }
  if (payload.filters.startDate || payload.filters.endDate) {
    const range = [payload.filters.startDate, payload.filters.endDate]
      .filter(Boolean).join(" to ");
    doc.text(`Date range: ${range}`, MARGIN, 42);
  }

  cur.y = 52;

  // =========================================================================
  // 1. Executive KPIs
  // =========================================================================
  sectionHeader(doc, cur, "1. Executive KPIs");

  kpiRow(doc, cur, [
    {
      label: "Recoverable Hours / Month",
      value: fmtHours(payload.recoverable.totalRecoverableHours),
      sub: `${payload.recoverable.totalRepetitiveMinutes.toLocaleString()} repetitive min`,
    },
    {
      label: "Recoverable Cost / Month",
      value: fmtINR(payload.recoverableInr.totalRecoverableInr),
      sub: `${payload.recoverableInr.metadata.rowsSkippedNoCompensation} rows without comp. data`,
    },
    {
      label: "Top Automation Priority",
      value: orNA(payload.automationPriority[0]?.taskCategory),
      sub: payload.automationPriority[0]
        ? `Score: ${payload.automationPriority[0].score} / 100`
        : "No data",
    },
  ]);

  cur.advance(SECTION_GAP);

  // =========================================================================
  // 2. Recoverable Hours by Department
  // =========================================================================
  sectionHeader(doc, cur, "2. Recoverable Hours by Department");

  table(
    doc, cur,
    ["Department", "Repetitive Min", "Recoverable Min", "Recoverable Hrs"],
    payload.recoverable.byDepartment.map((d) => [
      d.department,
      d.repetitiveMinutes.toLocaleString(),
      d.recoverableMinutes.toLocaleString(),
      (d.recoverableMinutes / 60).toFixed(1),
    ]),
    [58, 40, 44, 40],
    ["L", "R", "R", "R"]
  );

  cur.advance(SECTION_GAP);

  // =========================================================================
  // 3. Recoverable Cost by Department
  // =========================================================================
  sectionHeader(doc, cur, "3. Recoverable Cost by Department (INR / Month)");

  table(
    doc, cur,
    ["Department", "Recoverable Cost (INR)", "Employees"],
    payload.recoverableInr.byDepartment.map((d) => [
      d.department,
      fmtINR(d.recoverableInr),
      String(d.contributingEmployeeIds.length),
    ]),
    [72, 80, 30],
    ["L", "R", "R"]
  );

  cur.advance(SECTION_GAP);

  // =========================================================================
  // 4. Automation Priority Ranking
  // =========================================================================
  sectionHeader(doc, cur, "4. Automation Priority Ranking");

  table(
    doc, cur,
    ["#", "Task Category", "Score", "Feasibility", "INR Impact", "Employees"],
    payload.automationPriority.slice(0, 15).map((item, i) => [
      String(i + 1),
      item.taskCategory,
      `${item.score} / 100`,
      `${Math.round(item.automationFeasibility * 100)}%`,
      fmtINR(item.estimatedInrImpact),
      String(item.employeeCount),
    ]),
    [10, 54, 24, 24, 40, 30],
    ["R", "L", "R", "R", "R", "R"]
  );

  cur.advance(SECTION_GAP);

  // =========================================================================
  // 5. Employee Benchmarks
  // =========================================================================
  sectionHeader(doc, cur, "5. Employee Benchmarks");

  table(
    doc, cur,
    ["Employee", "Role", "Rep %", "Role Avg", "vs Avg", "Est. Cost (INR)"],
    payload.employeeBenchmarks.slice(0, 15).map((b) => {
      const delta = b.peerComparison.deltaFromRoleAvg;
      const deltaStr = delta > 0
        ? `+${delta} pp`
        : delta < 0
        ? `${delta} pp`
        : "0 pp";
      return [
        b.name,
        b.role,
        `${b.repetitivePercent}%`,
        `${b.peerComparison.roleAvgRepetitivePercent}%`,
        deltaStr,
        fmtINR(b.estimatedRepetitiveCostInr),
      ];
    }),
    [36, 40, 18, 20, 20, 48],
    ["L", "L", "R", "R", "R", "R"]
  );

  cur.advance(SECTION_GAP);

  // =========================================================================
  // 6. Week-over-Week Trends
  // =========================================================================
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
      [38, 24, 36, 36, 28],
      ["L", "R", "R", "R", "R"]
    );

    // WoW insight bullets
    const ins = payload.weekOverWeek.insights;
    if (ins) {
      cur.ensureSpace(28);

      setFont(doc, 8, "bold");
      setColor(doc, C_DARK);
      doc.text("Key Insights", MARGIN, cur.y);
      cur.advance(6);

      const bullets: { prefix: string; text: string }[] = [];

      if (ins.largestRepetitiveIncrease) {
        bullets.push({
          prefix: "Largest spike:",
          text: `${ins.largestRepetitiveIncrease.fromWeek} -> ${ins.largestRepetitiveIncrease.toWeek}  (+${ins.largestRepetitiveIncrease.deltaPercent} pp)`,
        });
      }
      if (ins.largestRepetitiveDecrease) {
        bullets.push({
          prefix: "Largest drop:",
          text: `${ins.largestRepetitiveDecrease.fromWeek} -> ${ins.largestRepetitiveDecrease.toWeek}  (${ins.largestRepetitiveDecrease.deltaPercent} pp)`,
        });
      }
      if (ins.fastestGrowingTask) {
        bullets.push({
          prefix: "Fastest-growing task:",
          text: `${ins.fastestGrowingTask.taskCategory}  (+${ins.fastestGrowingTask.deltaMinutes} min,  ${ins.fastestGrowingTask.fromWeek} -> ${ins.fastestGrowingTask.toWeek})`,
        });
      }
      if (ins.biggestDeptShift) {
        const dir = ins.biggestDeptShift.direction === "increase" ? "+" : "-";
        bullets.push({
          prefix: "Biggest dept shift:",
          text: `${ins.biggestDeptShift.department}  (${dir}${ins.biggestDeptShift.deltaMinutes} min,  ${ins.biggestDeptShift.fromWeek} -> ${ins.biggestDeptShift.toWeek})`,
        });
      }

      bullets.forEach((b) => {
        cur.ensureSpace(ROW_H);
        // Bullet dot
        setFont(doc, 8, "bold");
        setColor(doc, C_ACCENT);
        doc.text("*", MARGIN + 2, cur.y);
        // Prefix
        setFont(doc, 7.5, "bold");
        setColor(doc, C_DARK);
        doc.text(b.prefix, MARGIN + 6, cur.y);
        // Value
        setFont(doc, 7.5);
        setColor(doc, C_MID);
        doc.text(b.text, MARGIN + 6 + doc.getTextWidth(b.prefix) + 2, cur.y);
        cur.advance(ROW_H - 1);
      });
    }

    cur.advance(SECTION_GAP);
  }

  // =========================================================================
  // 7. Anomalies & Alerts
  // =========================================================================
  sectionHeader(doc, cur, "7. Anomalies & Alerts");

  if (payload.anomalies.length === 0) {
    cur.ensureSpace(10);
    setFont(doc, 8);
    setColor(doc, C_MID);
    doc.text("No anomalies detected in the current dataset.", MARGIN + 3, cur.y);
    cur.advance(10);
  } else {
    payload.anomalies.forEach((a, idx) => {
      cur.ensureSpace(22);

      // Severity label box (left edge)
      const sc: readonly [number, number, number] =
        a.severity === "high"   ? C_RED   :
        a.severity === "medium" ? C_AMBER :
        C_BLUE;

      fillRect(doc, MARGIN, cur.y, 16, 6, sc);
      doc.setTextColor(255, 255, 255);
      setFont(doc, 6, "bold");
      doc.text(a.severity.toUpperCase(), MARGIN + 1.5, cur.y + 4.2);

      // Title
      setFont(doc, 8, "bold");
      setColor(doc, C_DARK);
      const titleText = ascii(a.title);
      doc.text(titleText, MARGIN + 19, cur.y + 4.2);
      cur.advance(8);

      // Explanation — wrapped, indented
      setFont(doc, 7.5);
      setColor(doc, C_MID);
      const explanationLines = doc.splitTextToSize(
        ascii(a.explanation),
        CONTENT_W - 6
      ) as string[];
      explanationLines.forEach((line: string) => {
        cur.ensureSpace(ROW_H);
        doc.text(line, MARGIN + 3, cur.y);
        cur.advance(5.5);
      });

      // Supporting metrics — single line, smaller, lighter
      const metricsStr = Object.entries(a.supportingMetrics)
        .map(([k, v]) => `${ascii(k)}: ${ascii(String(v))}`)
        .join("   ");
      if (metricsStr) {
        cur.ensureSpace(ROW_H);
        setFont(doc, 6.5);
        setColor(doc, C_LIGHT);
        const mLines = doc.splitTextToSize(metricsStr, CONTENT_W - 6) as string[];
        mLines.forEach((line: string) => {
          cur.ensureSpace(6);
          doc.text(line, MARGIN + 3, cur.y);
          cur.advance(5);
        });
      }

      // Divider between anomalies (not after the last one)
      if (idx < payload.anomalies.length - 1) {
        cur.advance(2);
        hRule(doc, cur.y, C_RULE);
        cur.advance(4);
      } else {
        cur.advance(4);
      }
    });
  }

  cur.advance(SECTION_GAP);

  // =========================================================================
  // 8. Data Quality Audit
  // =========================================================================
  sectionHeader(doc, cur, "8. Data Quality Audit");

  const qr = payload.qualityReport;
  table(
    doc, cur,
    ["Metric", "Value"],
    [
      ["Total raw rows",                String(qr.totalRawRows)],
      ["Normalized rows",               String(qr.normalizedRows)],
      ["Dropped rows",                  String(qr.droppedRows)],
      ["Fixed / corrected rows",        String(qr.fixedRows)],
      ["Flagged rows (zero/outlier)",   String(qr.flaggedRows)],
      ["Duplicate rows removed",        String(qr.duplicateRowsRemoved)],
      ["Outlier rows (>720 min)",       String(qr.outlierRows)],
      ["Duplicate employee conflicts",  String(qr.duplicateEmployeeConflicts)],
      ["Employees missing metadata",    `${qr.employeesMissingMetadataCount}  (${qr.employeesMissingMetadata.join(", ") || "none"})`],
      ["Employees with no activity",    String(qr.metadataWithoutActivityCount)],
      ["Report generated at",           ascii(new Date(qr.generatedAt).toLocaleString("en-GB", { timeZone: "Asia/Kolkata" }) + " IST")],
    ],
    [110, 72],
    ["L", "R"]
  );

  // =========================================================================
  // Footer — every page
  // =========================================================================
  const totalPages = (doc as any).internal.getNumberOfPages() as number;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    hRule(doc, PAGE_H - 11, C_RULE);
    setFont(doc, 6.5);
    setColor(doc, C_LIGHT);
    doc.text("Workforce Pulse  |  Confidential", MARGIN, PAGE_H - 6.5);
    doc.text(
      `Page ${p} of ${totalPages}`,
      PAGE_W - MARGIN,
      PAGE_H - 6.5,
      { align: "right" }
    );
  }

  // =========================================================================
  // Save
  // =========================================================================
  const dateStr = new Date().toISOString().slice(0, 10);
  const suffix  = payload.filters.department
    ? `-${payload.filters.department.toLowerCase().replace(/\s+/g, "-")}`
    : "";
  doc.save(`workforce-pulse${suffix}-${dateStr}.pdf`);
}
