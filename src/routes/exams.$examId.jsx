import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import NavBar from "../components/NavBar.jsx";
import { getExam, addResult, getStudent, hasStudentTakenExam, getResults } from "../lib/store.js";

export const Route = createFileRoute("/exams/$examId")({
  component: ExamRunner,
});

// Score a single question. Returns true/false.
function isCorrect(q, answer) {
  const type = q.type || "multiple_choice";
  if (type === "short_answer") {
    if (!q.answer) return null; // manually graded — not counted
    return String(answer||"").trim().toLowerCase() === String(q.answer).trim().toLowerCase();
  }
  if (type === "checkbox") {
    if (answer === undefined) return false;
    const correct = [...(q.answers||[])].sort().join(",");
    const given = [...(answer||[])].sort().join(",");
    return correct === given;
  }
  // multiple_choice
  return answer === q.answer;
}

function ExamRunner() {
  const navigate = useNavigate();
  const { examId } = useParams({ from: "/exams/$examId" });
  const [exam, setExam] = useState(null);
  const [ready, setReady] = useState(false);
  const [student, setStudent] = useState(null);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [alreadyTaken, setAlreadyTaken] = useState(false);
  const [previousResult, setPreviousResult] = useState(null);
  const savedRef = useRef(false);

  useEffect(() => {
    const found = getExam(examId);
    setExam(found||null);
    setSecondsLeft(found ? found.minutes*60 : 0);
    const s = getStudent();
    setStudent(s);
    setReady(true);
    // If student already took this exam, jump straight to submitted view with their previous score
    if (s && found && hasStudentTakenExam(s, found.id)) {
      const prev = getResults().find((r) => r.student === s && r.examId === found.id);
      if (prev) setPreviousResult(prev);
      setSubmitted(true);
      setAlreadyTaken(true);
    }
  }, [examId]);

  useEffect(() => {
    if (!exam||submitted) return;
    if (secondsLeft<=0) { setSubmitted(true); return; }
    const t = setTimeout(() => setSecondsLeft((s) => s-1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, submitted, exam]);

  useEffect(() => {
    if (!submitted||!exam||savedRef.current||alreadyTaken) return;
    savedRef.current = true;
    const gradeable = exam.questions.filter((q) => isCorrect(q, answers[q.id]) !== null);
    const total = gradeable.length;
    const score = gradeable.reduce((acc,q) => acc + (isCorrect(q,answers[q.id]) ? 1 : 0), 0);
    const perQuestion = {};
    exam.questions.forEach((q) => { perQuestion[q.id] = isCorrect(q, answers[q.id]); });
    addResult({
      examId: exam.id, examTitle: exam.title, student: student||"Anonymous",
      score, total, percent: total ? Math.round((score/total)*100) : 0,
      at: new Date().toISOString(), perQuestion,
      answers: { ...answers },
    });
  }, [submitted, exam, answers, student]);

  if (!ready) return <div className="min-h-screen bg-background"><NavBar /><main className="mx-auto max-w-3xl px-5 py-20 text-center text-muted-foreground">Loading…</main></div>;

  if (!exam) return (
    <div className="min-h-screen bg-background"><NavBar />
      <main className="mx-auto max-w-3xl px-5 py-20 text-center">
        <h1 className="text-2xl font-bold text-primary">Exam not found</h1>
        <Link to="/exams" className="mt-4 inline-block text-primary underline">Back to exams</Link>
      </main>
    </div>
  );

  if (!student) return (
    <div className="min-h-screen bg-background"><NavBar />
      <main className="mx-auto max-w-md px-5 py-20 text-center">
        <h1 className="text-2xl font-bold text-primary">Sign in to take this exam</h1>
        <p className="mt-3 text-muted-foreground">Students must be signed in so results can be identified.</p>
        <button onClick={() => navigate({ to: "/login" })} className="btn-gold mt-6 inline-block">Go to login</button>
      </main>
    </div>
  );

  const gradeable = exam.questions.filter((q) => isCorrect(q, answers[q.id]) !== null);
  const score = alreadyTaken && previousResult ? previousResult.score : gradeable.reduce((acc,q) => acc + (isCorrect(q,answers[q.id]) ? 1 : 0), 0);
  const total = alreadyTaken && previousResult ? previousResult.total : gradeable.length;
  const percent = alreadyTaken && previousResult ? previousResult.percent : (total ? Math.round((score/total)*100) : 0);
  const mm = String(Math.floor(secondsLeft/60)).padStart(2,"0");
  const ss = String(secondsLeft%60).padStart(2,"0");

  function setAnswer(qid, val) { setAnswers((a) => ({ ...a, [qid]: val })); }

  function toggleCheckbox(qid, idx) {
    setAnswers((a) => {
      const prev = a[qid]||[];
      return { ...a, [qid]: prev.includes(idx) ? prev.filter((x) => x!==idx) : [...prev,idx] };
    });
  }

  // ── Results screen ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <NavBar />
        <section className="gradient-blue-amber py-10 text-center text-white">
          <h1 className="text-2xl font-bold sm:text-3xl">{exam.title} — Results</h1>
          <p className="mt-2 text-lg">You scored {score} out of {total} ({percent}%)</p>
        </section>
        <main className="mx-auto max-w-3xl px-5 py-12">
          {alreadyTaken && (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-center text-sm text-amber-700">
            You have already submitted this exam. Each exam can only be taken once.
          </div>
        )}
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Final Score</p>
            <p className="mt-4 text-5xl font-bold text-primary">{score}/{total}</p>
            <p className="mt-2 text-muted-foreground">{percent}% correct</p>
            {exam.questions.some((q) => q.type==="short_answer" && !q.answer) && (
              <p className="mt-3 text-sm text-amber-600">Note: Some short-answer questions require manual grading and are not counted above.</p>
            )}
          </div>

          <div className="mt-8 space-y-4">
            {exam.questions.map((q,i) => {
              const type = q.type || "multiple_choice";
              // When reviewing a previously-taken exam, load the student's saved answers
              const savedAnswers = alreadyTaken && previousResult?.answers ? previousResult.answers : answers;
              const userAnswer = savedAnswers[q.id];
              const result = isCorrect(q, userAnswer);

              return (
                <div key={q.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-bold ${
                      type==="multiple_choice"?"bg-blue-100 text-blue-700":type==="short_answer"?"bg-purple-100 text-purple-700":"bg-amber-100 text-amber-700"
                    }`}>{type==="multiple_choice"?"MC":type==="short_answer"?"SA":"CB"}</span>
                    <p className="font-semibold text-primary">{i+1}. {q.text}</p>
                  </div>

                  {type === "short_answer" && (
                    <div className="mt-3">
                      <p className="text-sm"><span className="font-medium">Your answer:</span> <span className={result===true?"text-success font-semibold":result===false?"text-destructive":""}>
                        {userAnswer||<em className="text-muted-foreground">No answer</em>}
                      </span></p>
                      {q.answer && <p className="text-sm"><span className="font-medium">Correct answer:</span> <span className="text-success">{q.answer}</span></p>}
                      {result===null && <p className="mt-1 text-xs text-amber-600">Manually graded — not counted in score.</p>}
                    </div>
                  )}

                  {(type === "multiple_choice" || type === "checkbox") && (
                    <div className="mt-3 space-y-2">
                      {(q.options||[]).map((opt,oi) => {
                        const isCorrectOpt = type==="multiple_choice" ? oi===q.answer : (q.answers||[]).includes(oi);
                        const isChosen = type==="multiple_choice" ? oi===userAnswer : (userAnswer||[]).includes(oi);
                        let cls = "border-border";
                        if (isCorrectOpt && isChosen) cls = "border-success bg-success/10 text-success";
                        else if (isCorrectOpt) cls = "border-success bg-success/5 text-success";
                        else if (isChosen) cls = "border-destructive bg-destructive/10 text-destructive";
                        return (
                          <div key={oi} className={`rounded-lg border px-4 py-2 text-sm ${cls}`}>
                            {opt}
                            {isCorrectOpt && isChosen ? " ✓" : isCorrectOpt ? " ✓ (correct)" : isChosen ? " ✗" : ""}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {userAnswer===undefined && type!=="short_answer" && <p className="mt-2 text-xs text-muted-foreground">Not answered</p>}
                  {result !== null && <p className={`mt-2 text-xs font-medium ${result?"text-success":"text-destructive"}`}>{result?"Correct":"Incorrect"}</p>}
                </div>
              );
            })}
          </div>
          <div className="mt-8"><Link to="/exams" className="btn-gold">Back to exams</Link></div>
        </main>
        <footer className="gradient-blue-amber py-6 text-center text-sm text-white">Built with QuizPoll · {new Date().getFullYear()}</footer>
      </div>
    );
  }

  // ── Active exam ─────────────────────────────────────────────────────────────
  const q = exam.questions[current];
  const qType = q.type || "multiple_choice";
  const answeredCount = exam.questions.filter((q) => answers[q.id] !== undefined).length;

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <section className="gradient-blue-amber py-8 text-center text-white">
        <h1 className="text-2xl font-bold sm:text-3xl">{exam.title}</h1>
        <p className="mt-2">Question {current+1} of {exam.questions.length}</p>
      </section>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{answeredCount} answered</span>
          <span className={`rounded-lg px-3 py-1.5 font-mono text-sm font-semibold ${secondsLeft<=30?"bg-destructive/10 text-destructive":"bg-muted"}`}>{mm}:{ss}</span>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width:`${((current+1)/exam.questions.length)*100}%` }} />
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-2">
            <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-bold ${
              qType==="multiple_choice"?"bg-blue-100 text-blue-700":qType==="short_answer"?"bg-purple-100 text-purple-700":"bg-amber-100 text-amber-700"
            }`}>{qType==="multiple_choice"?"MC":qType==="short_answer"?"SA":"CB"}</span>
            <p className="text-lg font-semibold text-primary">{q.text}</p>
          </div>

          {/* Multiple choice */}
          {qType === "multiple_choice" && (
            <div className="mt-5 space-y-3">
              {(q.options||[]).map((opt,oi) => {
                const selected = answers[q.id]===oi;
                return (
                  <button key={oi} onClick={() => setAnswer(q.id,oi)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${selected?"border-primary bg-primary/10":"border-border hover:bg-muted"}`}>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${selected?"border-primary bg-primary text-primary-foreground":"border-border"}`}>
                      {String.fromCharCode(65+oi)}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {/* Checkbox */}
          {qType === "checkbox" && (
            <div className="mt-5 space-y-3">
              <p className="text-xs text-muted-foreground">Select all that apply.</p>
              {(q.options||[]).map((opt,oi) => {
                const checked = (answers[q.id]||[]).includes(oi);
                return (
                  <button key={oi} onClick={() => toggleCheckbox(q.id,oi)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${checked?"border-primary bg-primary/10":"border-border hover:bg-muted"}`}>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${checked?"border-primary bg-primary text-primary-foreground":"border-border"}`}>
                      {checked && "✓"}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {/* Short answer */}
          {qType === "short_answer" && (
            <div className="mt-5">
              <textarea value={answers[q.id]||""} onChange={(e) => setAnswer(q.id,e.target.value)}
                placeholder="Type your answer here…"
                rows={3}
                className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:border-primary focus:outline-none" />
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button onClick={() => setCurrent((c) => Math.max(0,c-1))} disabled={current===0}
            className="rounded-lg border border-border px-5 py-2.5 font-semibold disabled:opacity-40 hover:bg-muted">Previous</button>
          {current < exam.questions.length-1 ? (
            <button onClick={() => setCurrent((c) => Math.min(exam.questions.length-1,c+1))} className="btn-gold">Next</button>
          ) : (
            <button onClick={() => setSubmitted(true)} className="rounded-lg bg-success px-5 py-2.5 font-semibold text-success-foreground">Submit exam</button>
          )}
        </div>
      </main>
      <footer className="gradient-blue-amber py-6 text-center text-sm text-white">Built with QuizPoll · {new Date().getFullYear()}</footer>
    </div>
  );
}
