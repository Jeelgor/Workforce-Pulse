# Workforce Pulse

## Project Overview
Workforce Pulse is an executive-grade operations dashboard built around a grounded analytics engine for workforce task data. It combines canonical normalization, compensation normaliza­tion, anomaly detection, and automation feasibility scoring into a single decision support experience.

## Key Features
- Executive KPI dashboard with recoverable hours, automation opportunity, and benchmark summaries
- Employee drilldown with role-based peer comparisons and task-level repetitive workload insight
- Week-over-week trend analysis for operational capacity and repetitive workload
- PDF export support for audited executive reporting
- Filter-driven analytics with department and date range controls

## Data Processing & Normalization
- Canonical normalization standardizes source activity log fields into a consistent internal model
- Compensation normalization aligns salary and cost assumptions to enable reliable INR recovery estimates
- Data is joined across log, employee, and quality records to support holistic metric computation
- Normalizers preserve auditability by keeping parsed timestamp metadata and original source labels

## Analytics Methodology
- Automation feasibility scoring ranks tasks by recoverable hours and impact potential
- Recoverable hours and INR estimates are derived from normalized repetitive task classifications and compensation data
- Anomaly detection identifies data gaps and outliers in timestamped activities and compensation coverage
- Trend calculations use weekly buckets to surface directional changes in repetitive workload and automation value

## AI Assistant Design
- Grounded Groq integration is used for assisted analysis and prompt-driven insight generation
- AI outputs are anchored in the normalized analytics dataset, not free-form model hallucinations
- The assistant is designed for contextual recommendations, not open-ended narrative

## Assumptions & Tradeoffs
- Designed for structured workforce activity logs rather than unbounded text input
- Prioritizes auditability and repeatable metric generation over exploratory natural-language modeling
- Current export and dashboard flows assume sufficient compensation metadata for cost estimations
- Filtering is intentionally lightweight to maintain deterministic analytics behavior

## Setup Instructions
1. Install dependencies: `npm install`
2. Start the application: `npm run dev`
3. Access the dashboard at `http://localhost:3000`

## Deployment
- Deployment link: `TBD`
