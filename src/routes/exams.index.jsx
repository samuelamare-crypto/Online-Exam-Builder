import { createFileRoute, Link } from "@tanstack/react-router";
import NavBar from "../components/NavBar.jsx";
import { useExams } from "../lib/store.js";


export const Route = createFileRoute("/exams/")({
  head: () => ({
    meta: [
      { title: "Exams — QuizPoll" },
      {
        name: "description",
        content: "Choose from a collection of timed multiple-choice exams and get instant scoring.",
      },
    ],
  }),
  component: ExamsList,
});

function ExamsList() {
  const [exams] = useExams();
  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <section className="gradient-blue-amber py-12 text-center text-white">
        <h1 className="text-3xl font-bold sm:text-4xl">Available Exams</h1>
        <p className="mt-3 text-lg">Pick a quiz to begin. Each one is timed.</p>
      </section>

      <main className="mx-auto max-w-5xl px-5 py-12">
        <div className="grid gap-5 sm:grid-cols-2">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <h2 className="text-xl font-semibold text-primary">{exam.title}</h2>
              <p className="mt-2 flex-1 text-muted-foreground">{exam.description}</p>
              <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                <span>{exam.questions.length} questions</span>
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
      </main>

      <footer className="gradient-blue-amber py-6 text-center text-sm text-white">
        Built with QuizPoll · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
