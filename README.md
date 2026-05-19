# Workforce Pulse — Methodology Document

## 1. Data Assumptions

### activity_logs.csv
- ~540 rows, 15 employees, 6 departments, ~4 weeks of activity (Oct 2025).
- Timestamps treated as IST wall-clock times with no offset marker; parsed and anchored to `+05:30` before storing as UTC epoch.
- Three timestamp formats handled: ISO 8601 (`2025-10-08T13:46:09`), space-separated (`2025-10-08 13:46`), and DD/MM/YYYY (`08/10/2025 13:46`).
- `duration_minutes`: negatives and blanks → `invalid` (null, excluded from KPIs); zero → `flagged_zero` (kept, excluded from KPIs); >720 min → `outlier` (kept, excluded from KPIs, tracked separately).
- `is_repetitive`: eleven variants normalised — `TRUE/true/1/yes/Yes` → `true`; everything else → `false`.
- `app_used` and `task_category`: lowercased, trimmed, mapped to canonical names via explicit lookup tables (e.g. `"gmail"`, `"Gmail"`, `" Gmail "` → `"Gmail"`).
- Rows with blank or `"?"` employee IDs are dropped (cannot be joined or attributed).

### employees.json
- Wrapped under top-level `employees` key alongside metadata fields (`generated_at`, `source_system`, etc.).
- Two schema shapes: PascalCase (`EmployeeID`, `Dept`, `salary_LPA`, `tenureMonths`, `workingHours`) and camelCase (`employee_id`, `department`, `annual_ctc_inr`, `tenure_months`, `working_hours`).
- `role` may be flat or nested under `meta.role`; `compensation` may be nested under `meta.compensation.annual`.
- `working_hours` normalised from string `"9-18"` or object `{"start":"09:00","end":"18:00"}` → canonical `{start, end}`.

## 2. Join Strategy & Conflict Resolution

**Duplicate employee (E007):** Two records share `E007` — one PascalCase with `salary_LPA: 14.0`, one camelCase with `annual_ctc_inr: 2400000`. Resolution: keep the record with the most fields (higher key count). The discarded record is preserved in `duplicateConflict.discarded` for audit. Both compensation values are close (~₹14L vs ₹24L); the richer camelCase record is kept.

**Missing employee:** One employee ID appears in activity logs but has no record in `employees.json`. Their logs are enriched with `employee: null`. They are counted in `employeesMissingMetadata` and excluded from INR calculations (no compensation data). Hours calculations still include them.

**Extra employee (E099):** Present in `employees.json` but never appears in activity logs. Counted in `metadataWithoutActivity`. No action taken — they may be on leave or recently onboarded.

**Terminated employee:** One employee has `terminated_on` set. Their records are included in the dataset as-is; the termination date is preserved in the normalised record. Activity logs before the termination date are valid.

## 3. Headline Number Formulas

### Recoverable Hours / Month
```
For each row where isRepetitive = true AND durationStatus = "valid":
  recoverableMinutes += durationMinutes × automationFeasibility(taskCategory)

totalRecoverableHours = sum(recoverableMinutes) / 60
```
`automationFeasibility` is a per-task multiplier (0–1) based on current tooling maturity:
- `Data Entry`, `Reconciliation` = 1.0 (RPA-ready, no judgment required)
- `Invoice Processing`, `Lead Entry`, `CRM Updates` = 0.9 (mature OCR/workflow automation)
- `Email Triage`, `Reporting` = 0.8 (AI routing tools reliable)
- `Meetings`, `Client Comms` = 0.1–0.3 (human presence essential)

Outliers (>720 min) and invalid/zero durations are excluded and tracked separately.

### Recoverable INR / Month
```
For each row where isRepetitive = true AND durationStatus = "valid"
  AND employee.hourlyCostInr is known:
  recoverableHours = durationMinutes × automationFeasibility / 60
  recoverableINR  += recoverableHours × employee.hourlyCostInr
```
Hourly cost derivation (160 working hours/month assumed):
- `annual_ctc_inr` → monthly = annual ÷ 12, hourly = monthly ÷ 160
- `salary_LPA` → annual = LPA × 100,000, then same as above
- `hourly_rate_inr` → used directly; monthly = hourly × 160
- `meta.compensation.annual` → treated as `annual_ctc_inr`

Rows without compensation data are excluded and counted in `rowsSkippedNoCompensation`. The methodology is visible in the UI via the ⓘ tooltip on the INR KPI card.

## 4. Automation Priority Ranking Formula

Composite score (weighted sum, then min-max normalised to 0–100):
```
raw = (repetitiveRatio × 0.30)   // how repetitive is this task?
    + (inrImpactRatio  × 0.35)   // how much money is at stake?
    + (employeeConc    × 0.20)   // how many employees are affected?
    + (volumeRatio     × 0.15)   // how many sessions does it generate?
```
Each ratio is computed relative to the maximum across all tasks, then multiplied by `automationFeasibility` so low-feasibility tasks are naturally deprioritised. INR impact is the primary driver (35%) because it directly answers the COO's question.

## 5. Anomaly Detection

Deterministic threshold logic — no ML, every flag has a numeric explanation:
- **High repetitive employee**: individual ≥20 pp above role average (medium) or ≥35 pp (high)
- **High repetitive department**: department ≥15 pp above org average (medium) or ≥25 pp (high)
- **Extreme task concentration**: one task ≥60% of an employee's total minutes (medium) or ≥75% (high)
- **Dept task concentration**: one task ≥55% of a department's repetitive minutes (medium) or ≥70% (high)
- **Outlier duration**: any row with duration >720 minutes

## 6. What Was Cut and Why

- **Per-app INR breakdown**: App is not linked to individual compensation records in the data model, so per-app INR would require an arbitrary allocation. Cut to avoid indefensible numbers; hours-only app breakdown is shown instead.
- **Real-time streaming AI responses**: Groq supports streaming; not implemented to keep the assistant code simple and auditable. Non-streaming responses are returned in <2s for this dataset size.
- **Historical trend beyond 4 weeks**: Dataset only covers ~4 weeks; no synthetic data was added per the constraints.

## 7. What I'd Build Next (2 More Days)

1. **Drill-down audit trail**: Click any KPI number to see the exact rows that contributed to it — full traceability from headline to source CSV row.
2. **Per-employee week-over-week**: Show each employee's repetitive% trend across the 4 weeks, not just the org-level trend.
3. **Automation ROI calculator**: Let the COO input an automation tool cost and see the payback period against the recoverable INR figure.

## Setup

```bash
npm install
# Add GROQ_API_KEY to .env
npm run dev   # http://localhost:3000
```

## Deployment

Live URL: TBD (Vercel deployment)
