import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import NavBar from "../components/NavBar.jsx";
import { useAuth } from "../lib/AuthContext.jsx";
import { getExam, listQuestionsPublic, getMyAttempt, submitAttempt } from "../lib/db.js";

export const Route = createFileRoute("/exams/$examId")({
  component: ExamRunner,
});

function ExamRunner() {
  const navigate       = useNavigate();
  const { examId }     = useParams({ from: "/exams/$examId" });
  const { user, loading: sessionLoading } = useAuth();

  const [exam, setExam]           = useState(null);
  const [questions, setQuestions] = useState([]);
  const [ready, setReady]         = useState(false);
  const [loadError, setLoadError] = useState("");

  const [answers, setAnswers]     = useState({});
  const [current, setCurrent]     = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [alreadyTaken, setAlreadyTaken] = useState(false);
  // Grading result from submitAttempt() RPC or a loaded previous attempt.
  // Shape: { score, total, percent, per_question, review }
  const [result, setResult]       = useState(null);
  const savedRef = useRef(false);

  // ── Load exam + check for previous attempt ──────────────────────────────
  useEffect(() => {
    if (sessionLoading) return;
    let cancelled = false;

    async function load() {
      try {
        const [examData, questionRows] = await Promise.all([
          getExam(examId),
          listQuestionsPublic(examId),
        ]);
        if (cancelled) return;
        if (!examData) { setReady(true); return; }
        setExam(examData);
        setQuestions(questionRows);
        setSecondsLeft(examData.minutes * 60);

        if (user) {
          const prev = await getMyAttempt(examId, user.id);
          if (!cancelled && prev) {
            setResult({ score: prev.score, total: prev.total, percent: prev.percent, per_question: prev.per_question, review: prev.review });
            setAnswers(prev.answers || {});
            setSubmitted(true);
            setAlreadyTaken(true);
          }
        }
      } catch (e) {
        if (!cancelled) setLoadError(e.message);
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [examId, user, sessionLoading]);

  // ── Countdown timer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!exam || submitted) return;
    if (secondsLeft <= 0) { setSubmitted(true); return; }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, submitted, exam]);

  // ── Submit for grading (runs once on first submission) ──────────────────
  useEffect(() => {
    if (!submitted || !exam || savedRef.current || alreadyTaken || !user) return;
    savedRef.current = true;
    setSubmitting(true);
    submitAttempt(exam.id, answers)
      .then((data) => { if (data) setResult(data); })
      .catch((e) => setSubmitError(e.message))
      .finally(() => setSubmitting(false));
  }, [submitted, exam, answers, alreadyTaken, user]);

  // ── Shared answer helpers ───────────────────────────────────────────────
  function setAnswer(qid, val) { setAnswers((a) => ({ ...a, [qid]: val })); }
  function toggleCheckbox(qid, idx) {
    setAnswers((a) => {
      const prev = a[qid] || [];
      return { ...a, [qid]: prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx] };
    });
  }

  // ── Loading / error shells ───────────────────────────────────────────────
  const Shell = ({ children }) => (
    <div className="min-h-screen bg-background"><NavBar />
      <main className="mx-auto max-w-3xl px-5 py-20 text-center">{children}</main>
      <footer className="gradient-blue-amber py-6 text-center text-sm text-white">Built with QuizPoll · {new Date().getFullYear()}</footer>
    </div>
  );

  if (!ready) return <Shell><p className="text-muted-foreground">Loading…</p></Shell>;

  if (loadError) return (
    <Shell>
      <h1 className="text-2xl font-bold text-destructive">Couldn't load this exam</h1>
      <p className="mt-3 text-muted-foreground">{loadError}</p>
      <Link to="/exams" className="mt-4 inline-block text-primary underline">Back to exams</Link>
    </Shell>
  );

  if (!exam) return (
    <Shell>
      <h1 className="text-2xl font-bold text-primary">Exam not found</h1>
      <Link to="/exams" className="mt-4 inline-block text-primary underline">Back to exams</Link>
    </Shell>
  );

  if (!user) return (
    <Shell>
      <h1 className="text-2xl font-bold text-primary">Sign in to take this exam</h1>
      <p className="mt-3 text-muted-foreground">Students must be signed in so results can be saved.</p>
      <button onClick={() => navigate({ to: "/login" })} className="btn-gold mt-6 inline-block">Go to login</button>
    </Shell>
  );

  // ── Results screen ───────────────────────────────────────────────────────
  if (submitted) {
    const reviewById = {};
    (result?.review || []).forEach((r) => { reviewById[r.id] = r; });
    const score   = result?.score ?? 0;
    const total   = result?.total ?? 0;
    const percent = result?.percent ?? 0;

    const TYPE_COLOR = { multiple_choice: "bg-blue-100 text-blue-700", short_answer: "bg-purple-100 text-purple-700", checkbox: "bg-amber-100 text-amber-700" };
    const TYPE_BADGE = { multiple_choice: "MC", short_answer: "SA", checkbox: "CB" };

    return (
      <div className="min-h-screen bg-background">
        <NavBar />
        <section className="gradient-blue-amber py-10 text-center text-white">
          <h1 className="text-2xl font-bold sm:text-3xl">{exam.title} — Results</h1>
          <p className="mt-2 text-lg">{submitting ? "Grading…" : `You scored ${score} out of ${total} (${percent}%)`}</p>
        </section>
        <main className="mx-auto max-w-3xl px-5 py-12">
          {submitError && (
            <div className="mb-6 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-center text-sm text-destructive">
              Couldn't save your results: {submitError}
            </div>
          )}
          {alreadyTaken && (
            <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-center text-sm text-amber-700">
              You already submitted this exam. Showing your original result.
            </div>
          )}
          {!submitting && result && (
            <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Final Score</p>
              <p className="mt-4 text-5xl font-bold text-primary">{score}/{total}</p>
              <p className="mt-2 text-muted-foreground">{percent}% correct</p>
            </div>
          )}
          {!submitting && result && (
            <div className="mt-8 space-y-4">
              {questions.map((q, i) => {
                const t = q.type || "multiple_choice";
                const userAnswer = answers[q.id];
                const r = reviewById[q.id] || {};
                const isCorrectResult = result.per_question ? result.per_question[q.id] : null;

                return (
                  <div key={q.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-bold ${TYPE_COLOR[t]}`}>{TYPE_BADGE[t]}</span>
                      <p className="font-semibold text-primary">{i + 1}. {q.text}</p>
                    </div>

                    {t === "short_answer" && (
                      <div className="mt-3 text-sm">
                        <p><span className="font-medium">Your answer:</span>{" "}
                          <span className={isCorrectResult === true ? "font-semibold text-green-700" : isCorrectResult === false ? "text-destructive" : ""}>
                            {userAnswer || <em className="text-muted-foreground">No answer</em>}
                          </span>
                        </p>
                        {r.correct_answer_text && <p><span className="font-medium">Correct answer:</span> <span className="text-green-700">{r.correct_answer_text}</span></p>}
                        {isCorrectResult === null && <p className="mt-1 text-xs text-amber-600">Manually graded — not counted in score.</p>}
                      </div>
                    )}

                    {(t === "multiple_choice" || t === "checkbox") && (
                      <div className="mt-3 space-y-2">
                        {(q.options || []).map((opt, oi) => {
                          const isCorrectOpt = t === "multiple_choice"
                            ? oi === r.correct_answer_index
                            : (r.correct_answer_indices || []).includes(oi);
                          const isChosen = t === "multiple_choice"
                            ? oi === userAnswer
                            : (userAnswer || []).includes(oi);
                          let cls = "border-border";
                          if (isCorrectOpt && isChosen) cls = "border-green-600 bg-green-50 text-green-700";
                          else if (isCorrectOpt)         cls = "border-green-600 bg-green-50/50 text-green-700";
                          else if (isChosen)             cls = "border-destructive bg-destructive/10 text-destructive";
                          return (
                            <div key={oi} className={`rounded-lg border px-4 py-2 text-sm ${cls}`}>
                              {opt}{isCorrectOpt && isChosen ? " ✓" : isCorrectOpt ? " ✓ (correct)" : isChosen ? " ✗" : ""}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {userAnswer === undefined && t !== "short_answer" && <p className="mt-2 text-xs text-muted-foreground">Not answered</p>}
                    {isCorrectResult !== null && (
                      <p className={`mt-2 text-xs font-medium ${isCorrectResult ? "text-green-700" : "text-destructive"}`}>
                        {isCorrectResult ? "Correct" : "Incorrect"}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-8"><Link to="/exams" className="btn-gold">Back to exams</Link></div>
        </main>
        <footer className="gradient-blue-amber py-6 text-center text-sm text-white">Built with QuizPoll · {new Date().getFullYear()}</footer>
      </div>
    );
  }

  // ── Active exam ──────────────────────────────────────────────────────────
  const q = questions[current];
  if (!q) return <Shell><p className="text-muted-foreground">This exam has no questions yet.</p></Shell>;

  const qType = q.type || "multiple_choice";
  const answeredCount = questions.filter((qq) => answers[qq.id] !== undefined).length;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <section className="gradient-blue-amber py-8 text-center text-white">
        <h1 className="text-2xl font-bold sm:text-3xl">{exam.title}</h1>
        <p className="mt-2">Question {current + 1} of {questions.length}</p>
      </section>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{answeredCount} answered</span>
          <span className={`rounded-lg px-3 py-1.5 font-mono text-sm font-semibold ${secondsLeft <= 30 ? "bg-destructive/10 text-destructive" : "bg-muted"}`}>{mm}:{ss}</span>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${((current + 1) / questions.length) * 100}%` }} />
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-2">
            <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-bold ${
              qType === "multiple_choice" ? "bg-blue-100 text-blue-700" : qType === "short_answer" ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700"
            }`}>{qType === "multiple_choice" ? "MC" : qType === "short_answer" ? "SA" : "CB"}</span>
            <p className="text-lg font-semibold text-primary">{q.text}</p>
          </div>

          {qType === "multiple_choice" && (
            <div className="mt-5 space-y-3">
              {(q.options || []).map((opt, oi) => {
                const selected = answers[q.id] === oi;
                return (
                  <button key={oi} onClick={() => setAnswer(q.id, oi)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${selected ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                      {String.fromCharCode(65 + oi)}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {qType === "checkbox" && (
            <div className="mt-5 space-y-3">
              <p className="text-xs text-muted-foreground">Select all that apply.</p>
              {(q.options || []).map((opt, oi) => {
                const checked = (answers[q.id] || []).includes(oi);
                return (
                  <button key={oi} onClick={() => toggleCheckbox(q.id, oi)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${checked ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${checked ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                      {checked && "✓"}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {qType === "short_answer" && (
            <div className="mt-5">
              <textarea value={answers[q.id] || ""} onChange={(e) => setAnswer(q.id, e.target.value)}
                placeholder="Type your answer here…" rows={3}
                className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:border-primary focus:outline-none" />
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0}
            className="rounded-lg border border-border px-5 py-2.5 font-semibold disabled:opacity-40 hover:bg-muted">Previous</button>
          {current < questions.length - 1 ? (
            <button onClick={() => setCurrent((c) => c + 1)} className="btn-gold">Next</button>
          ) : (
            <button onClick={() => setSubmitted(true)} className="rounded-lg bg-green-600 px-5 py-2.5 font-semibold text-white hover:bg-green-700">
              Submit exam
            </button>
          )}
        </div>
      </main>
      <footer className="gradient-blue-amber py-6 text-center text-sm text-white">Built with QuizPoll · {new Date().getFullYear()}</footer>
    </div>
  );
}
