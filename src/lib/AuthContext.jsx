// Wraps Supabase Auth + the matching `profiles` row (username, role) in one
// place, so every route just calls useAuth() instead of reaching into
// localStorage/sessionStorage the way the old store.js did.
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const AuthContext = createContext(null);

function toErrorMessage(error, fallback) {
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    if (typeof error.message === "string" && error.message.trim()) return error.message;
    if (typeof error.error_description === "string" && error.error_description.trim()) {
      return error.error_description;
    }
  }
  return fallback;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId) {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, role")
      .eq("id", userId)
      .single();
    if (error) {
      console.error("Failed to load profile:", error.message);
      setProfile(null);
      return;
    }
    setProfile(data);
  }

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session?.user?.id);
      if (active) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      loadProfile(newSession?.user?.id);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Returns { ok, error?, needsEmailConfirmation? }
  async function signUp(email, password, username) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      if (error) return { ok: false, error: toErrorMessage(error, "Account creation failed.") };
      return { ok: true, needsEmailConfirmation: !data?.session };
    } catch (error) {
      return { ok: false, error: toErrorMessage(error, "Account creation failed.") };
    }
  }

  // Returns { ok, error? }
  async function signIn(email, password) {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, error: toErrorMessage(error, "Sign in failed.") };
      return { ok: true };
    } catch (error) {
      return { ok: false, error: toErrorMessage(error, "Sign in failed.") };
    }
  }

  async function signOut() {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Sign out failed:", toErrorMessage(error, "Sign out failed."));
    }
  }

  // Returns { ok, error? }. Used by the account-settings panel.
  async function updatePassword(newPassword) {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { ok: false, error: toErrorMessage(error, "Password update failed.") };
      return { ok: true };
    } catch (error) {
      return { ok: false, error: toErrorMessage(error, "Password update failed.") };
    }
  }

  // Returns { ok, error? }
  async function updateUsername(newUsername) {
    if (!session?.user) return { ok: false, error: "Not signed in." };
    const { error } = await supabase
      .from("profiles")
      .update({ username: newUsername })
      .eq("id", session.user.id);
    if (error) {
      const message = error.code === "23505" ? "That username is already taken." : toErrorMessage(error, "Username update failed.");
      return { ok: false, error: message };
    }
    await loadProfile(session.user.id);
    return { ok: true };
  }

  const value = {
    user: session?.user ?? null,
    profile,
    username: profile?.username ?? null,
    role: profile?.role ?? null,
    isAdmin: profile?.role === "admin",
    loading,
    signUp,
    signIn,
    signOut,
    updatePassword,
    updateUsername,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
