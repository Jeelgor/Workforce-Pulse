// Temporary debug endpoint — DELETE after fixing the API key issue
import Groq from "groq-sdk";

export async function GET() {
  const key = process.env.GROQ_API_KEY;

  if (!key) {
    return Response.json({ hasKey: false });
  }

  try {
    const groq = new Groq({ apiKey: key });
    const result = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: "Say OK" }],
      max_tokens: 5,
    });
    return Response.json({
      hasKey: true,
      length: key.length,
      prefix: key.slice(0, 8),
      groqStatus: "OK",
      reply: result.choices[0]?.message?.content,
    });
  } catch (err: any) {
    return Response.json({
      hasKey: true,
      length: key.length,
      prefix: key.slice(0, 8),
      groqStatus: "ERROR",
      error: err?.message ?? String(err),
      status: err?.status ?? null,
    });
  }
}
