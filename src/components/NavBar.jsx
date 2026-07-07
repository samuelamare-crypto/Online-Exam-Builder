import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "../lib/AuthContext.jsx";

export default function NavBar() {
  const navigate = useNavigate();
  const { user, isAdmin, username, loading, signOut } = useAuth();

  async function handleLogout() {
    await signOut();
    navigate({ to: "/login" });
  }

  return (
    <header className="gradient-blue-amber sticky top-0 z-20 text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-10 py-3">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 font-bold">Q</span>
          QuizPoll
        </Link>
        <nav className="flex items-center gap-8">
          <Link to="/exams" className="font-semibold text-white transition hover:text-[#ffcc00]">Exams</Link>
          <Link to="/polls" className="font-semibold text-white transition hover:text-[#ffcc00]">Polls</Link>
          {isAdmin && (
            <Link to="/admin" className="font-semibold text-white transition hover:text-[#ffcc00]">Admin</Link>
          )}
          {!loading && user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-[#ffcc00]">{isAdmin ? "Admin" : username || "…"}</span>
              <button onClick={handleLogout} className="rounded-lg bg-white/20 px-3 py-1.5 text-sm font-semibold transition hover:bg-white/30">
                Logout
              </button>
            </div>
          ) : !loading ? (
            <Link to="/login" className="font-semibold text-white transition hover:text-[#ffcc00]">Login</Link>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
