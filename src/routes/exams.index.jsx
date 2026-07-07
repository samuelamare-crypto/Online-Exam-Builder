import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import NavBar from "../components/NavBar.jsx";
import { listExams } from "../lib/db.js";

export const Route = createFileRoute("/exams/")({
  head: () => ({
    meta: [
      { title: "Exams — QuizPoll" },
      { name: "description", content: "Choose from a collection of timed exams and get instant scoring." },
    ],
  }),
  component: ExamsList,
});

function ExamsList() {
  const [exams, setExams]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  useEffect(() => {
    let cancelled = false;
    listExams()
      .then((data) => { if (!cancelled) setExams(data); })
      .catch((e)   => { if (!cancelled) setError(e.message); })
      .finally(()  => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <section className="gradient-blue-amber py-12 text-center text-white">
        <h1 className="text-3xl font-bold sm:text-4xl">Available Exams</h1>
        <p className="mt-3 text-lg">Pick a quiz to begin. Each one is timed.</p>
      </section>

      <main className="mx-auto max-w-5xl px-5 py-12">
        {loading && <p className="text-center text-muted-foreground">Loading exams…</p>}
        {error   && <p className="text-center text-destructive">{error}</p>}
        <div className="grid gap-5 sm:grid-cols-2">
          {exams.map((exam) => (
            <div key={exam.id} className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-primary">{exam.title}</h2>
              <p className="mt-2 flex-1 text-muted-foreground">{exam.description}</p>
              <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                <span>{exam.questionCount} question{exam.questionCount !== 1 ? "s" : ""}</span>
                <span>·</span>
                <span>{exam.minutes} min</span>
              </div>
              <Link
                to="/exams/$examId"
                params={{ examId: exam.id }}
                className="btn-gold mt-5 inline-block w-fit"
              >
                Start exam
              </Link>
            </div>
          ))}
        </div>
        {!loading && !error && exams.length === 0 && (
          <p className="text-center text-muted-foreground">No exams available yet.</p>
        )}
      </main>

      <footer className="gradient-blue-amber py-6 text-center text-sm text-white">
        Built with QuizPoll · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
