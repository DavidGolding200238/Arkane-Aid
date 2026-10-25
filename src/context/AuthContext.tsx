import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User, AuthError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendResetCode: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, password: string) => Promise<void>;
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
    // Reset: a wrong or used code reads the same as an expired one, and nothing says whether the
    // email has an account.
    if (msg.includes("expired") || msg.includes("invalid") || msg.includes("token") || status === 403) {
      return "That code is wrong or has expired. Send a new code and try again.";
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
  // While a reset is mid-way, the code has signed the user in but the new password is not set yet.
  // Hold that session back so the app stays on the reset screen until the password is saved.
  const holdSession = useRef(false);
  const heldSession = useRef<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

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

    return () => subscription.unsubscribe();
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
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error("Could not sign out. Try again.");
  };

  const sendResetCode = async (email: string) => {
    // Supabase emails a recovery code. The "Reset Password" email template must include
    // {{ .Token }} for the 6-digit code to appear in it.
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw new Error(publicAuthMessage(error, "reset"));
  };

  const resetPassword = async (email: string, code: string, password: string) => {
    holdSession.current = true;
    let verified = false;
    try {
      const { error: codeError } = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
      if (codeError) throw new Error(publicAuthMessage(codeError, "reset"));
      verified = true;
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(publicAuthMessage(error, "reset"));
    } catch (err) {
      // The code is used up once verified; drop that half-finished sign-in so the old password
      // still works and a new code can be sent.
      if (verified) await supabase.auth.signOut({ scope: "local" });
      heldSession.current = undefined;
      throw err;
    } finally {
      holdSession.current = false;
    }
    // New password saved: let the session through, which opens the app signed in.
    if (heldSession.current !== undefined) setSession(heldSession.current);
    heldSession.current = undefined;
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
        sendResetCode,
        resetPassword,
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
