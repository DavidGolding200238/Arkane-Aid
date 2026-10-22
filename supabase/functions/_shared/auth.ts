// Only signed-in players may spend the Groq and Google quotas. The gateway's verify_jwt check
// (on by default, see supabase/config.toml) already rejects calls without a valid token; this
// also asks Supabase Auth who the token belongs to. The returned client acts as that user, so
// Row Level Security applies to anything it reads. No secret key is used.
import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

export type Caller = { user: User; db: SupabaseClient };

export async function requireUser(request: Request): Promise<Caller | null> {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const url = Deno.env.get("SUPABASE_URL");
  const key = publishableKey();
  if (!url || !key) return null;
  const db = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, db };
}

/** The project's publishable key (new key system), or the legacy anon key. */
function publishableKey(): string | undefined {
  const keys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (keys) {
    try {
      const parsed = JSON.parse(keys) as Record<string, string>;
      if (parsed.default) return parsed.default;
      const first = Object.values(parsed)[0];
      if (first) return first;
    } catch {
      // fall through to the legacy key
    }
  }
  return Deno.env.get("SUPABASE_ANON_KEY") ?? undefined;
}
