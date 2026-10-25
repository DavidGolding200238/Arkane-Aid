import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Linking } from "react-native";
import type { Session, User, AuthError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

/** Where the reset email's link sends the phone. Must be in Supabase's Redirect URLs list. */
export const RESET_REDIRECT = "arkaneaid://reset-password";
// Set while a reset link has signed the user in but the new password is not saved yet, so a
// restart in between drops that session instead of opening the app signed in.
const RECOVERY_PENDING_KEY = "arkaneaid.recoveryPending";

/** Reset link state: "ready" = link opened, ask for the new password; "invalid" = bad/expired link. */
export type Recovery = "none" | "ready" | "invalid";

/**
 * Pull the reset details out of a link. Implicit flow (this client's default) puts the tokens in
 * the #fragment; PKCE would put ?code= in the query. Errors (e.g. otp_expired) can be in either.
 */
function parseRecoveryUrl(url: string) {
  const hashAt = url.indexOf("#");
  const queryAt = url.indexOf("?");
  const fragment = new URLSearchParams(hashAt >= 0 ? url.slice(hashAt + 1) : "");
  const query = new URLSearchParams(
    queryAt >= 0 ? url.slice(queryAt + 1, hashAt > queryAt ? hashAt : undefined) : ""
  );
  const get = (key: string) => fragment.get(key) ?? query.get(key);
  const isReset = url.toLowerCase().includes("reset-password") || get("type") === "recovery";
  return {
    isReset,
    error: get("error") ?? get("error_code"),
    accessToken: get("access_token"),
    refreshToken: get("refresh_token"),
    code: query.get("code"),
  };
}

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  recovery: Recovery;
  sendResetLink: (email: string) => Promise<void>;
  saveNewPassword: (password: string) => Promise<void>;
  cancelRecovery: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Map Supabase Auth errors to messages that do not reveal whether an email is
 * registered. Passwords are never logged here; they only go to Supabase Auth
 * over HTTPS, which hashes them server-side (bcrypt). The client never stores
 * the password — only the session tokens Supabase writes through its auth storage.
 */
function publicAuthMessage(error: AuthError, kind: "in" | "up" | "reset"): string {
  const msg = (error.message || "").toLowerCase();
  const status = error.status;

  if (kind === "in") {
    // Invalid login, unknown user, wrong password, etc. → one message.
    if (
      status === 400 ||
      msg.includes("invalid login") ||
      msg.includes("invalid credentials") ||
      msg.includes("email not confirmed") ||
      msg.includes("user not found")
    ) {
      // Keep email-not-confirmed distinct so the user knows to check their inbox,
      // without saying whether a *different* email exists.
      if (msg.includes("email not confirmed")) {
        return "Confirm your email before signing in.";
      }
      return "Email or password is incorrect.";
    }
  } else if (kind === "reset") {
    // Reset: a used or expired link reads the same, and nothing says whether the email has an
    // account.
    if (
      msg.includes("expired") ||
      msg.includes("invalid") ||
      msg.includes("token") ||
      msg.includes("session") ||
      status === 401 ||
      status === 403
    ) {
      return "That reset link is invalid or has expired. Send a new link and try again.";
    }
    if (msg.includes("different from the old") || msg.includes("same password")) {
      return "That is already your password. Go back and log in with it.";
    }
    if (msg.includes("password") && (msg.includes("least") || msg.includes("weak") || msg.includes("short"))) {
      return "Password is too short. Use at least 8 characters.";
    }
    if (msg.includes("security purposes")) return "Too many attempts. Wait a moment and try again.";
  } else {
    // Sign-up: avoid "User already registered" leaking account existence.
    if (msg.includes("already") || msg.includes("registered") || status === 422) {
      return "Could not create that account. Try signing in, or use a different email.";
    }
    if (msg.includes("password") && (msg.includes("least") || msg.includes("weak") || msg.includes("short"))) {
      return "Password is too short. Use at least 8 characters.";
    }
  }

  // Network / rate limits / anything else: safe generic.
  if (msg.includes("rate") || status === 429) return "Too many attempts. Wait a moment and try again.";
  if (msg.includes("network") || msg.includes("fetch")) return "Could not reach the server. Check your connection.";
  return "Something went wrong. Try again.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState<Recovery>("none");
  // While a reset is mid-way, the link has signed the user in but the new password is not set yet.
  // Hold that session back so the app stays on the reset screen until the password is saved.
  const holdSession = useRef(false);
  const heldSession = useRef<Session | null | undefined>(undefined);

  useEffect(() => {
    let live = true;

    const start = async () => {
      // A reset left half-finished (app closed before the new password was saved): drop it.
      if (localStorage.getItem(RECOVERY_PENDING_KEY)) {
        localStorage.removeItem(RECOVERY_PENDING_KEY);
        await supabase.auth.signOut({ scope: "local" });
      }
      const { data } = await supabase.auth.getSession();
      if (!live) return;
      if (holdSession.current) heldSession.current = data.session;
      else setSession(data.session);
      setLoading(false);
    };

    const openLink = async (url: string | null | undefined) => {
      if (!url) return;
      const link = parseRecoveryUrl(url);
      if (!link.isReset) return;
      if (link.error || (!link.code && (!link.accessToken || !link.refreshToken))) {
        setRecovery("invalid");
        return;
      }
      holdSession.current = true;
      localStorage.setItem(RECOVERY_PENDING_KEY, "1");
      setSession(null);
      const { error } = link.code
        ? await supabase.auth.exchangeCodeForSession(link.code)
        : await supabase.auth.setSession({
            access_token: link.accessToken as string,
            refresh_token: link.refreshToken as string,
          });
      if (error) {
        holdSession.current = false;
        heldSession.current = undefined;
        localStorage.removeItem(RECOVERY_PENDING_KEY);
        await supabase.auth.signOut({ scope: "local" });
        setRecovery("invalid");
        return;
      }
      setRecovery("ready");
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (holdSession.current) {
        heldSession.current = next;
        return;
      }
      setSession(next);
      setLoading(false);
    });

    // The reset email's link opens the app (cold start) or arrives while it is running.
    const linkSub = Linking.addEventListener("url", ({ url }) => void openLink(url));
    void start()
      .then(() => Linking.getInitialURL())
      .then((url) => {
        if (live) void openLink(url);
      });

    return () => {
      live = false;
      subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(publicAuthMessage(error, "in"));
  };

  const signUp = async (email: string, password: string) => {
    // Password goes only to Supabase Auth (HTTPS). No client-side hashing, no
    // writing the password to AsyncStorage/SQLite — Supabase stores the session
    // tokens only, and hashes the password with bcrypt on the server.
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(publicAuthMessage(error, "up"));
  };

  const signOut = async () => {
    // This phone only: the default ("global") also ends the account's sessions on every other phone.
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw new Error("Could not sign out. Try again.");
  };

  const sendResetLink = async (email: string) => {
    // Supabase emails a link (the default template's {{ .ConfirmationURL }}) that opens the app.
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: RESET_REDIRECT });
    if (error) throw new Error(publicAuthMessage(error, "reset"));
  };

  const saveNewPassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(publicAuthMessage(error, "reset"));
    // New password saved: let the session through, which opens the app signed in.
    holdSession.current = false;
    localStorage.removeItem(RECOVERY_PENDING_KEY);
    const held = heldSession.current;
    heldSession.current = undefined;
    setRecovery("none");
    if (held !== undefined) setSession(held);
    else setSession((await supabase.auth.getSession()).data.session);
  };

  const cancelRecovery = async () => {
    // Back out of a reset: drop the link's half-finished sign-in so the old password still works.
    if (holdSession.current) await supabase.auth.signOut({ scope: "local" });
    holdSession.current = false;
    heldSession.current = undefined;
    localStorage.removeItem(RECOVERY_PENDING_KEY);
    setSession(null);
    setRecovery("none");
  };

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        recovery,
        sendResetLink,
        saveNewPassword,
        cancelRecovery,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
