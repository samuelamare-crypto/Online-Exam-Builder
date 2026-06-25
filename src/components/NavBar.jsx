import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getStudent, isAdmin, logout } from "../lib/store.js";

export default function NavBar() {
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    setStudent(getStudent());
    setAdmin(isAdmin());
  }, []);

  function handleLogout() {
    logout();
    setStudent(null);
    setAdmin(false);
    navigate({ to: "/login" });
  }

  return (
    <header className="gradient-blue-amber sticky top-0 z-20 text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-10 py-3">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white font-bold">
            Q
          </span>
          QuizPoll
        </Link>
        <nav className="flex items-center gap-8 list-none">
          <Link
            to="/exams"
            className="cursor-pointer font-semibold text-white transition hover:text-[#ffcc00]"
          >
            Exams
          </Link>
          <Link
            to="/polls"
            className="cursor-pointer font-semibold text-white transition hover:text-[#ffcc00]"
          >
            Polls
          </Link>
          {admin && (
            <Link
              to="/admin"
              className="cursor-pointer font-semibold text-white transition hover:text-[#ffcc00]"
            >
              Admin
            </Link>
          )}
          {student || admin ? (
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-[#ffcc00]">
                {admin ? "Admin" : student}
              </span>
              <button
                onClick={handleLogout}
                className="cursor-pointer rounded-lg bg-white/20 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white/30"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="cursor-pointer font-semibold text-white transition hover:text-[#ffcc00]"
            >
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
