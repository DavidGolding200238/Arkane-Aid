// Small helpers every function shares: CORS, JSON replies, and one error shape.
// Every error body is { error: string, code: ErrorCode } so the app can react to the code
// and show the message.

export type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "not_configured"
  | "upstream_failed"
  | "empty_reply"
  | "method_not_allowed";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: cors });
}

export function fail(status: number, code: ErrorCode, error: string): Response {
  return json({ error, code }, status);
}

export function preflight(request: Request): Response | null {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return fail(405, "method_not_allowed", "Use POST.");
  return null;
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

export function text(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}
