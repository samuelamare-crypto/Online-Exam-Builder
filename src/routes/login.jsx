import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import NavBar from "../components/NavBar.jsx";
import { loginStudent, registerStudent, loginAdmin } from "../lib/store.js";

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
  const [mode, setMode] = useState("signin"); // signin | register
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Try admin credentials first (email ignored for admin)
    if (loginAdmin(username, password)) {
      navigate({ to: "/admin" });
      return;
    }

    // Otherwise treat as student
    const res =
      mode === "register"
        ? registerStudent(username, password, email)
        : loginStudent(username, password);

    if (res.ok) {
      navigate({ to: "/exams" });
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <section className="gradient-blue-amber py-12 text-center text-white">
        <h1 className="text-3xl font-bold sm:text-4xl">Welcome to QuizPoll</h1>
        <p className="mt-2">Sign in to continue.</p>
      </section>

      <main className="mx-auto max-w-md px-5 py-12">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-primary">
            {mode === "register" ? "Create an account" : "Sign in"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "register"
              ? "Pick a username and password to get started."
              : "Enter your credentials to continue."}
          </p>

          <label className="mt-4 block text-sm font-semibold text-primary">
            Username
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. jane"
            autoComplete="username"
            className="mt-2 w-full rounded-lg border border-border px-4 py-2.5"
          />

          <label className="mt-4 block text-sm font-semibold text-primary">
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="mt-2 w-full rounded-lg border border-border px-4 py-2.5"
          />

          <label className="mt-4 block text-sm font-semibold text-primary">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            className="mt-2 w-full rounded-lg border border-border px-4 py-2.5"
          />

          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

          <button type="submit" className="btn-gold mt-4 w-full">
            {mode === "register" ? "Create account & continue" : "Sign in"}
          </button>

          {mode === "signin" && (
            <button
              type="button"
              onClick={() => { setMode("register"); setError(""); }}
              className="mt-3 w-full text-sm font-semibold text-primary hover:underline"
            >
              New here? Create an account
            </button>
          )}

          {mode === "register" && (
            <button
              type="button"
              onClick={() => { setMode("signin"); setError(""); }}
              className="mt-3 w-full text-sm font-semibold text-primary hover:underline"
            >
              Already have an account? Sign in
            </button>
          )}
        </form>
      </main>

      <footer className="gradient-blue-amber py-6 text-center text-sm text-white">
        Built with QuizPoll · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
