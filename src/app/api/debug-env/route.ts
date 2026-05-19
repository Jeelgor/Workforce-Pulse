// Temporary debug endpoint — DELETE after fixing the API key issue
export async function GET() {
  const key = process.env.GROQ_API_KEY;
  return Response.json({
    hasKey: !!key,
    length: key?.length ?? 0,
    prefix: key ? key.slice(0, 8) : "NOT SET",
    suffix: key ? key.slice(-4) : "NOT SET",
  });
}
