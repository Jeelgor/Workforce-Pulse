// =============================================================================
// /api/assistant — AI assistant endpoint for Workforce Pulse
//
// Flow:
//   1. Receive user question
//   2. Run full analytics pipeline (server-side, no raw CSV sent to LLM)
//   3. Build structured context string from analytics outputs
//   4. Construct system + user prompts
//   5. Call Groq API (llama-3.3-70b-versatile)
//   6. Return concise operational answer
// =============================================================================

import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { loadAllData } from "@/lib/data/loaders";
import {
  recoverableHours,
  recoverableInr,
  automationPriorityRanking,
  employeeBenchmarks,
  weekOverWeekTrends,
  detectAnomalies,
} from "@/lib/data/analytics";
import { buildAnalyticsContext } from "@/lib/ai/context-builder";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/ai/prompts";

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------

interface AssistantRequest {
  question: string;
  /** Prior conversation turns — used for multi-turn follow-ups */
  history?: { role: "user" | "assistant"; content: string }[];
  /** Optional active dashboard filters — used to scope analytics context */
  filters?: {
    department?: string;
    startDate?: string;
    endDate?: string;
  };
}

interface AssistantResponse {
  answer: string;
  /** ISO timestamp of when the response was generated */
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<Response> {
  // ── 1. Parse and validate request ────────────────────────────────────────
  let body: AssistantRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = body.question?.trim();
  if (!question || question.length < 3) {
    return Response.json({ error: "Question is required" }, { status: 400 });
  }
  if (question.length > 500) {
    return Response.json(
      { error: "Question must be 500 characters or fewer" },
      { status: 400 }
    );
  }

  // Sanitise history — cap at last 10 turns to stay within token budget,
  // strip anything that isn't a plain user/assistant string pair.
  const history: { role: "user" | "assistant"; content: string }[] = (
    Array.isArray(body.history) ? body.history : []
  )
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-20); // last 10 turns = 5 exchanges

  // ── 2. Run analytics pipeline ─────────────────────────────────────────────
  // All computation happens server-side. Raw CSV/JSON never leaves the server.
  let analyticsContext: string;
  try {
    const { logReport, joinReport, qualityReport } = loadAllData();

    // Apply optional filters from the dashboard
    const { department, startDate, endDate } = body.filters ?? {};
    const filterRow = (row: { department: string; timestamp: Date | null }) => {
      if (department && row.department !== department) return false;
      if ((startDate || endDate) && row.timestamp) {
        const ts = row.timestamp.getTime();
        if (startDate && ts < new Date(startDate + "T00:00:00+05:30").getTime()) return false;
        if (endDate && ts > new Date(endDate + "T23:59:59+05:30").getTime()) return false;
      }
      return true;
    };

    const filteredNorm = logReport.normalized.filter(filterRow);
    const filteredEnriched = joinReport.enriched.filter(filterRow);

    const ctx = {
      recoverable: recoverableHours(filteredNorm),
      recoverableInr: recoverableInr(filteredEnriched),
      automationPriority: automationPriorityRanking(filteredEnriched),
      employeeBenchmarks: employeeBenchmarks(filteredEnriched),
      weekOverWeek: weekOverWeekTrends(filteredNorm),
      anomalies: detectAnomalies(filteredEnriched),
      qualityReport,
    };

    analyticsContext = buildAnalyticsContext(ctx);
  } catch (err) {
    return Response.json(
      { error: "Failed to compute analytics context" },
      { status: 500 }
    );
  }

  // ── 3. Call Groq API ──────────────────────────────────────────────────────
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "GROQ_API_KEY is not configured" },
      { status: 500 }
    );
  }

  try {
    const groq = new Groq({ apiKey });

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        // System prompt with full analytics context — always first
        {
          role: "system",
          content: buildSystemPrompt(analyticsContext),
        },
        // Prior conversation turns (multi-turn support)
        ...history,
        // Current user question
        {
          role: "user",
          content: buildUserPrompt(question),
        },
      ],
      temperature: 0.2,
      max_tokens: 512,
      top_p: 0.9,
    });

    const answer =
      completion.choices[0]?.message?.content?.trim() ??
      "I was unable to generate a response. Please try again.";

    const response: AssistantResponse = {
      answer,
      generatedAt: new Date().toISOString(),
    };

    return Response.json(response);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error calling Groq API";
    return Response.json({ error: message }, { status: 502 });
  }
}
