import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import NavBar from "../components/NavBar.jsx";
import { useAuth } from "../lib/AuthContext.jsx";

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

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — QuizPoll" },
      { name: "description", content: "Sign in to take exams or manage them." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState("signin"); // signin | register
  const [username, setUsername] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) { setError("Enter your email and password."); return; }
    if (mode === "register" && !username.trim()) { setError("Enter a username."); return; }
    setLoading(true);
    try {
      if (mode === "register") {
        const res = await signUp(email.trim(), password, username.trim());
        if (!res.ok) { setError(toErrorMessage(res.error, "Account creation failed.")); return; }
        // After sign-up Supabase sends a confirmation email. If the project has
        // email confirmation disabled (Settings → Auth → Confirm email = OFF),
        // the session is created immediately and the auth state change fires
        // automatically — navigate normally. If confirmation is required, let
        // the user know.
        if (res.needsEmailConfirmation) {
          setError(""); // clear field
          setMode("confirm");
          return;
        }
        navigate({ to: "/exams" });
      } else {
        const res = await signIn(email.trim(), password);
        if (!res.ok) { setError(toErrorMessage(res.error, "Sign in failed.")); return; }
        // The auth state change fires and AuthContext loads the profile. Route
        // to exams by default; admins will see the Admin link in the nav.
        navigate({ to: "/exams" });
      }
    } catch (error) {
      setError(toErrorMessage(error, "Something went wrong while creating your account."));
    } finally {
      setLoading(false);
    }
  }

  if (mode === "confirm") {
    return (
      <div className="min-h-screen bg-background">
        <NavBar />
        <main className="mx-auto max-w-md px-5 py-20 text-center">
          <h1 className="text-2xl font-bold text-primary">Check your inbox</h1>
          <p className="mt-3 text-muted-foreground">
            We sent a confirmation link to <strong>{email}</strong>. Click it to
            activate your account, then come back and sign in.
          </p>
          <button onClick={() => setMode("signin")} className="btn-gold mt-6 inline-block">
            Back to sign in
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <section className="gradient-blue-amber py-12 text-center text-white">
        <h1 className="text-3xl font-bold sm:text-4xl">Welcome to QuizPoll</h1>
        <p className="mt-2">Sign in to continue.</p>
      </section>

      <main className="mx-auto max-w-md px-5 py-12">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-primary">
            {mode === "register" ? "Create an account" : "Sign in"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "register"
              ? "Pick a username, enter your email and a password."
              : "Enter your email and password."}
          </p>

          {mode === "register" && (
            <>
              <label htmlFor="username" className="mt-4 block text-sm font-semibold text-primary">Username</label>
              <input
                id="username"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. jane"
                autoComplete="username"
                className="mt-2 w-full rounded-lg border border-border px-4 py-2.5"
              />
            </>
          )}

          <label htmlFor="email" className="mt-4 block text-sm font-semibold text-primary">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="mt-2 w-full rounded-lg border border-border px-4 py-2.5"
          />

          <label htmlFor="password" className="mt-4 block text-sm font-semibold text-primary">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            className="mt-2 w-full rounded-lg border border-border px-4 py-2.5"
          />

          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

          <button type="submit" disabled={loading} className="btn-gold mt-4 w-full disabled:opacity-60">
            {loading ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}
          </button>

          <button
            type="button"
            onClick={() => { setMode(mode === "signin" ? "register" : "signin"); setError(""); }}
            className="mt-3 w-full text-sm font-semibold text-primary hover:underline"
          >
            {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Admin? Sign in with your admin email above — the dashboard will appear in the nav once signed in.
        </p>
      </main>

      <footer className="gradient-blue-amber py-6 text-center text-sm text-white">
        Built with QuizPoll · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
