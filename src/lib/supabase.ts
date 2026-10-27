import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import { createClient } from "@supabase/supabase-js";
import "expo-sqlite/localStorage/install";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env."
  );
}

// Auth storage holds Supabase session tokens only (access/refresh), via Expo SQLite's
// localStorage polyfill. Passwords are never written here — they go to Supabase Auth over
// HTTPS and are hashed server-side (bcrypt). See AuthContext and README Authentication.
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Whether the Google provider is switched on in Supabase (Authentication > Providers). Reads the
 * public /auth/v1/settings endpoint with the publishable key. Returns null if it can't be reached.
 */
export async function googleEnabled(): Promise<boolean | null> {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabasePublishableKey as string },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { external?: { google?: boolean } };
    return body.external?.google === true;
  } catch {
    return null;
  }
}

// Supabase's React Native setup: refresh tokens only while the app is on screen. Without this the
// refresh timer can fire as the app goes to the background (e.g. switching to WhatsApp to copy a
// party code); if Android cuts that request off after the server has rotated the token, the phone
// keeps the old refresh token, the next refresh is refused as reused, and supabase-js signs out.
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
