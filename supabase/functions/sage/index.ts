import personalities from "../../../src/data/sage-personalities.json" with { type: "json" };

type PersonaName = keyof typeof personalities;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) {
    return Response.json(
      { error: "GROQ_API_KEY is not set on this function yet." },
      { status: 503, headers: cors }
    );
  }

  const payload = await request.json().catch(() => ({}));
  const personaName = (payload.persona ?? "sage") as PersonaName;
  const persona = personalities[personaName];
  const question = String(payload.question ?? "").trim();
  const sheet = String(payload.sheet ?? "").trim();

  if (!persona) {
    return Response.json(
      { error: `Unknown persona. Use ${Object.keys(personalities).join(", ")}.` },
      { status: 400, headers: cors }
    );
  }
  if (!question) {
    return Response.json({ error: "Missing question." }, { status: 400, headers: cors });
  }

  const userContent =
    sheet && !question.includes("Player sheet:")
      ? `Player sheet:\n${sheet}\n\n${question}`
      : question;

  const groq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: persona.model,
      temperature: persona.temperature,
      max_tokens: 512,
      reasoning_effort: "low",
      messages: [
        { role: "system", content: persona.system },
        { role: "user", content: userContent },
      ],
    }),
  });

  const data = await groq.json();
  if (!groq.ok) {
    const detail = data?.error?.message ?? "Groq rejected the request.";
    return Response.json({ error: detail }, { status: 502, headers: cors });
  }

  const message = data.choices?.[0]?.message ?? {};
  const reply = String(message.content || message.reasoning || "").trim();

  return Response.json(
    {
      persona: persona.name,
      reply,
    },
    { headers: cors }
  );
});
