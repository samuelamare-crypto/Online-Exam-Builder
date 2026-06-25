import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { parseFileQuestions } from "../lib/api/parse-file.functions";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import NavBar from "../components/NavBar.jsx";
import {
  getExams, addExam, removeExam, addQuestion, updateQuestion, removeQuestion,
  getResults, clearResults, getQuestionStats,
  getPolls, addPoll, updatePoll, removePoll,
  getAdminCreds, setAdminCreds, isAdmin,
  importQuestionsToExam,
} from "../lib/store.js";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — QuizPoll" },
      { name: "description", content: "Manage exam questions and review results." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState("dashboard");

  useEffect(() => {
    setMounted(true);
    setAuthed(isAdmin());
  }, []);

  if (!mounted) return <div className="min-h-screen bg-background"><NavBar /><main className="mx-auto max-w-md px-5 py-20 text-center text-muted-foreground">Loading…</main></div>;

  if (!authed) return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-md px-5 py-20 text-center">
        <h1 className="text-2xl font-bold text-primary">Admin access required</h1>
        <p className="mt-3 text-muted-foreground">Please sign in as an admin to manage subjects and review results.</p>
        <button onClick={() => navigate({ to: "/login" })} className="btn-gold mt-6 inline-block">Go to login</button>
      </main>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <section className="gradient-blue-amber py-10 text-center text-white">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="mt-2">Manage questions, polls and review performance.</p>
      </section>
      <main className="mx-auto max-w-5xl px-5 py-10">
        <div className="mb-8 flex flex-wrap gap-2">
          {[["dashboard","Dashboard"],["subjects","Subjects"],["questions","Questions"],["polls","Polls"],["results","Results"],["settings","Settings"]].map(([id,label]) => (
            <button key={id} onClick={() => setTab(id)} className={`rounded-lg px-4 py-2 font-semibold transition ${tab === id ? "btn-gold" : "border border-border hover:bg-muted"}`}>{label}</button>
          ))}
        </div>
        {tab === "dashboard" && <Dashboard />}
        {tab === "subjects"  && <SubjectsManager />}
        {tab === "questions" && <QuestionsManager />}
        {tab === "polls"     && <PollsManager />}
        {tab === "results"   && <ResultsView />}
        {tab === "settings"  && <SettingsManager />}
      </main>
      <footer className="gradient-blue-amber py-6 text-center text-sm text-white">Built with QuizPoll · {new Date().getFullYear()}</footer>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
const DIFFICULTY_COLOR = { Easy: "#16a34a", Medium: "#b88a1f", Hard: "#dc2626" };

function Dashboard() {
  const results = getResults();
  const stats = getQuestionStats();
  const [selectedExam, setSelectedExam] = useState(stats[0] ? stats[0].examId : "");
  const examAverages = stats.map((s) => {
    const examResults = results.filter((r) => r.examId === s.examId);
    const avg = examResults.length ? Math.round(examResults.reduce((a, r) => a + r.percent, 0) / examResults.length) : 0;
    return { name: s.title, average: avg, attempts: examResults.length };
  });
  const current = stats.find((s) => s.examId === selectedExam) || stats[0];
  const difficultyData = current ? current.questions.filter((q) => q.correctRate !== null).map((q, i) => ({ name: "Q" + (i + 1), fullText: q.text, correctRate: q.correctRate, difficulty: q.difficulty })) : [];
  const totalAttempts = results.length;
  const overallAvg = results.length ? Math.round(results.reduce((a, r) => a + r.percent, 0) / results.length) : 0;
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Attempts" value={totalAttempts} />
        <StatCard label="Average Score" value={overallAvg + "%"} />
        <StatCard label="Active Exams" value={stats.length} />
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">Average Score by Exam</h2>
        {examAverages.length === 0 ? <p className="mt-3 text-muted-foreground">No data yet.</p> : (
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={examAverages}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis domain={[0,100]} unit="%" /><Tooltip /><Bar dataKey="average" fill="#2948a8" radius={[6,6,0,0]} /></BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-primary">Question Difficulty</h2>
          <select value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm">
            {stats.map((s) => <option key={s.examId} value={s.examId}>{s.title}</option>)}
          </select>
        </div>
        {difficultyData.length === 0 ? <p className="mt-3 text-muted-foreground">No answered questions yet.</p> : (
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={difficultyData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis domain={[0,100]} unit="%" />
                <Tooltip formatter={(v,_n,p) => [v+"% correct", p.payload.difficulty]} labelFormatter={(l,p) => (p[0] ? p[0].payload.fullText : l)} />
                <Bar dataKey="correctRate" radius={[6,6,0,0]}>{difficultyData.map((d,i) => <Cell key={i} fill={DIFFICULTY_COLOR[d.difficulty]||"#2948a8"} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-4xl font-bold text-primary">{value}</p>
    </div>
  );
}

// ─── SubjectsManager ──────────────────────────────────────────────────────────
function SubjectsManager() {
  const [exams, setExams] = useState(getExams());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [minutes, setMinutes] = useState(5);

  function handleAdd(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setExams([...addExam({ title, description, minutes })]);
    setTitle(""); setDescription(""); setMinutes(5);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdd} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">Add a Subject</h2>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Subject title (e.g. Mathematics)" className="mt-4 w-full rounded-lg border border-border px-4 py-2.5" />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" className="mt-3 w-full rounded-lg border border-border px-4 py-2.5" />
        <div className="mt-3 flex items-center gap-3">
          <label className="text-sm font-semibold text-primary">Time limit (minutes)</label>
          <input type="number" min="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} className="w-24 rounded-lg border border-border px-3 py-2" />
        </div>
        <button type="submit" className="btn-gold mt-4">Add subject</button>
      </form>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">Subjects ({exams.length})</h2>
        <div className="mt-4 space-y-3">
          {exams.map((ex) => (
            <div key={ex.id} className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
              <div>
                <p className="font-medium text-foreground">{ex.title}</p>
                <p className="text-sm text-muted-foreground">{ex.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">{ex.questions.length} questions · {ex.minutes} min</p>
              </div>
              <button onClick={() => { if (window.confirm("Delete this subject and all its questions?")) setExams([...removeExam(ex.id)]); }} className="shrink-0 rounded-lg border border-destructive px-3 py-1.5 text-sm font-semibold text-destructive hover:bg-destructive/10">Remove</button>
            </div>
          ))}
          {exams.length === 0 && <p className="text-muted-foreground">No subjects yet. Add one above.</p>}
        </div>
      </div>
    </div>
  );
}

// ─── QuestionsManager ─────────────────────────────────────────────────────────
function QuestionsManager() {
  const [exams, setExams] = useState(getExams());
  const [examId, setExamId] = useState(exams[0] ? exams[0].id : "");
  const [qType, setQType] = useState("multiple_choice");
  const [text, setText] = useState("");
  const [options, setOptions] = useState(["","","",""]);
  const [answer, setAnswer] = useState(0);           // for MC: index
  const [checkAnswers, setCheckAnswers] = useState([]); // for checkbox: indices[]
  const [shortAnswer, setShortAnswer] = useState(""); // for short_answer
  const [editingId, setEditingId] = useState(null);

  const exam = exams.find((e) => e.id === examId);

  function refresh(next) { setExams([...next]); }

  function resetForm() {
    setText(""); setOptions(["","","",""]); setAnswer(0);
    setCheckAnswers([]); setShortAnswer(""); setEditingId(null);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    let payload;
    if (qType === "short_answer") {
      payload = { type: "short_answer", text: text.trim(), answer: shortAnswer.trim() };
    } else if (qType === "checkbox") {
      const cleaned = options.map((o) => o.trim()).filter(Boolean);
      if (cleaned.length < 2) return;
      payload = { type: "checkbox", text: text.trim(), options: cleaned, answers: checkAnswers };
    } else {
      const cleaned = options.map((o) => o.trim()).filter(Boolean);
      if (cleaned.length < 2) return;
      payload = { type: "multiple_choice", text: text.trim(), options: cleaned, answer: Math.min(answer, cleaned.length - 1) };
    }
    const next = editingId ? updateQuestion(examId, editingId, payload) : addQuestion(examId, payload);
    refresh(next); resetForm();
  }

  function handleEdit(q) {
    setEditingId(q.id); setText(q.text);
    const t = q.type || "multiple_choice";
    setQType(t);
    if (t === "short_answer") {
      setShortAnswer(q.answer || "");
    } else if (t === "checkbox") {
      const padded = [...(q.options||[])]; while (padded.length < 4) padded.push("");
      setOptions(padded); setCheckAnswers(q.answers || []);
    } else {
      const padded = [...(q.options||[])]; while (padded.length < 4) padded.push("");
      setOptions(padded); setAnswer(q.answer || 0);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleCheckAnswer(i) {
    setCheckAnswers((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);
  }

  const TYPE_BADGE = { multiple_choice: "MC", short_answer: "SA", checkbox: "CB" };
  const TYPE_COLOR = { multiple_choice: "bg-blue-100 text-blue-700", short_answer: "bg-purple-100 text-purple-700", checkbox: "bg-amber-100 text-amber-700" };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <label className="text-sm font-semibold text-primary">Exam</label>
        <select value={examId} onChange={(e) => { setExamId(e.target.value); resetForm(); }} className="rounded-lg border border-border px-3 py-2 text-sm">
          {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
        </select>
      </div>

      {/* Manual add/edit form */}
      <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">{editingId ? "Edit Question" : "Add a Question"}</h2>

        {/* Question type selector */}
        <div className="mt-4 flex gap-2">
          {[["multiple_choice","Multiple Choice"],["short_answer","Short Answer"],["checkbox","Checkbox"]].map(([val,label]) => (
            <button key={val} type="button" onClick={() => { setQType(val); setCheckAnswers([]); }}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${qType === val ? "btn-gold" : "border-border hover:bg-muted"}`}>
              {label}
            </button>
          ))}
        </div>

        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Question text" className="mt-4 w-full rounded-lg border border-border px-4 py-2.5" />

        {qType === "short_answer" && (
          <div className="mt-4">
            <label className="text-sm font-semibold text-primary">Expected answer (used for auto-grading)</label>
            <input value={shortAnswer} onChange={(e) => setShortAnswer(e.target.value)} placeholder="Correct answer text" className="mt-2 w-full rounded-lg border border-border px-4 py-2.5" />
            <p className="mt-1 text-xs text-muted-foreground">Grading is case-insensitive. Leave blank to mark as manually graded.</p>
          </div>
        )}

        {(qType === "multiple_choice" || qType === "checkbox") && (
          <div className="mt-4 space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                {qType === "multiple_choice" ? (
                  <input type="radio" name="correct" checked={answer === i} onChange={() => setAnswer(i)} title="Mark as correct answer" className="shrink-0" />
                ) : (
                  <input type="checkbox" checked={checkAnswers.includes(i)} onChange={() => toggleCheckAnswer(i)} title="Mark as correct answer" className="shrink-0" />
                )}
                <input value={opt} onChange={(e) => { const next=[...options]; next[i]=e.target.value; setOptions(next); }}
                  placeholder={`Option ${String.fromCharCode(65 + i < 91 ? 65+i : 65)}`} className="w-full rounded-lg border border-border px-4 py-2" />
                {options.length > 2 && (
                  <button type="button" onClick={() => {
                    const next = options.filter((_,j) => j !== i);
                    setOptions(next);
                    if (qType === "multiple_choice" && answer >= next.length) setAnswer(next.length - 1);
                    if (qType === "checkbox") setCheckAnswers((prev) => prev.filter((x) => x !== i).map((x) => x > i ? x-1 : x));
                  }} className="shrink-0 rounded-lg border border-destructive px-2 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10" title="Remove option">✕</button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setOptions((o) => [...o, ""])}
              className="mt-1 rounded-lg border border-dashed border-primary px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/5">
              + Add option
            </button>
            <p className="text-xs text-muted-foreground">
              {qType === "multiple_choice" ? "Select the radio button next to the correct answer." : "Check all correct answers (multiple allowed)."}
            </p>
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <button type="submit" className="btn-gold">{editingId ? "Save changes" : "Add question"}</button>
          {editingId && <button type="button" onClick={resetForm} className="rounded-lg border border-border px-4 py-2 font-semibold hover:bg-muted">Cancel</button>}
        </div>
      </form>

      {/* File import */}
      {examId && <ImportQuestions examId={examId} onImport={refresh} />}

      {/* Question list */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">Questions ({exam ? exam.questions.length : 0})</h2>
        <div className="mt-4 space-y-3">
          {exam && exam.questions.map((q, i) => {
            const t = q.type || "multiple_choice";
            return (
              <div key={q.id} className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-bold ${TYPE_COLOR[t]}`}>{TYPE_BADGE[t]}</span>
                    <p className="font-medium text-foreground">{i+1}. {q.text}</p>
                  </div>
                  {t === "short_answer" && (
                    <p className="mt-1 text-sm text-muted-foreground">Answer: <span className="font-medium text-foreground">{q.answer || <em>manually graded</em>}</span></p>
                  )}
                  {(t === "multiple_choice" || t === "checkbox") && (
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {(q.options||[]).map((o,oi) => {
                        const isCorrect = t === "multiple_choice" ? oi === q.answer : (q.answers||[]).includes(oi);
                        return <li key={oi} className={isCorrect ? "text-success font-semibold" : ""}>{String.fromCharCode(65+oi)}. {o}{isCorrect ? " ✓" : ""}</li>;
                      })}
                    </ul>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <button onClick={() => handleEdit(q)} className="rounded-lg border border-primary px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/10">Edit</button>
                  <button onClick={() => { refresh(removeQuestion(examId, q.id)); if (editingId===q.id) resetForm(); }} className="rounded-lg border border-destructive px-3 py-1.5 text-sm font-semibold text-destructive hover:bg-destructive/10">Remove</button>
                </div>
              </div>
            );
          })}
          {exam && exam.questions.length === 0 && <p className="text-muted-foreground">No questions yet. Add one above.</p>}
        </div>
      </div>
    </div>
  );
}

// ─── ImportQuestions ─────────────────────────────────────────────────────────
// Accepts: .json  .csv  .docx  .pdf
// CSV columns: type,text,option_a,option_b,...,option_n,answer
//   type = multiple_choice|short_answer|checkbox
//   answer = 0-based index (MC) | comma-separated indices (checkbox) | answer text (SA)
// JSON: [{ type, text, options?, answer?, answers? }]
// DOCX: mammoth extracts text → Claude API parses
// PDF:  file sent as base64 to Claude API directly (no worker needed)
function ImportQuestions({ examId, onImport }) {
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState(null);
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");

  // ── parsers ────────────────────────────────────────────────────────────────
  function parseJSON(text) {
    try {
      const data = JSON.parse(text);
      if (!Array.isArray(data)) return { questions: [], errors: ["JSON must be an array."] };
      return { questions: data, errors: [] };
    } catch (e) { return { questions: [], errors: ["Invalid JSON: " + e.message] }; }
  }

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return { questions: [], errors: ["CSV has no data rows."] };
    const errors = [], questions = [];
    // Header: type,text,option_a,option_b,...,answer
    const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g,"").trim().toLowerCase());
    const typeIdx   = headers.indexOf("type");
    const textIdx   = headers.indexOf("text");
    const answerIdx = headers.lastIndexOf("answer");
    // option columns = everything between text and answer
    const optCols = [];
    for (let i = 0; i < headers.length; i++) {
      if (i !== typeIdx && i !== textIdx && i !== answerIdx && headers[i].startsWith("option")) optCols.push(i);
    }
    const clean = (s) => (s||"").replace(/^"|"$/g,"").trim();
    for (let i = 1; i < lines.length; i++) {
      // simple CSV split (handles quoted fields)
      const cols = [];
      let cur = "", inQ = false;
      for (const ch of lines[i] + ",") {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === "," && !inQ) { cols.push(cur); cur = ""; }
        else cur += ch;
      }
      const type = typeIdx >= 0 ? (clean(cols[typeIdx]) || "multiple_choice") : "multiple_choice";
      const qtext = textIdx >= 0 ? clean(cols[textIdx]) : clean(cols[0]);
      const answerRaw = answerIdx >= 0 ? clean(cols[answerIdx]) : "";
      if (!qtext) { errors.push(`Row ${i+1}: empty text.`); continue; }

      if (type === "short_answer") {
        questions.push({ type: "short_answer", text: qtext, answer: answerRaw });
        continue;
      }
      const opts = optCols.map((ci) => clean(cols[ci])).filter(Boolean);
      if (opts.length < 2) { errors.push(`Row ${i+1}: need at least 2 options.`); continue; }
      if (type === "checkbox") {
        const answers = answerRaw.split(",").map((x) => parseInt(x.trim(),10)).filter((n) => !isNaN(n) && n >= 0 && n < opts.length);
        questions.push({ type: "checkbox", text: qtext, options: opts, answers });
      } else {
        const ans = parseInt(answerRaw, 10);
        if (isNaN(ans) || ans < 0 || ans >= opts.length) { errors.push(`Row ${i+1}: answer index out of range.`); continue; }
        questions.push({ type: "multiple_choice", text: qtext, options: opts, answer: ans });
      }
    }
    return { questions, errors };
  }

  // Browser reads file as base64; server does text extraction + AI parsing
  async function fileToBase64(file) {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result.split(",")[1]);
      reader.onerror = () => rej(new Error("Could not read file"));
      reader.readAsDataURL(file);
    });
  }

  async function handleFile(file) {
    if (!file) return;
    setStatus(null); setPreview(null); setFileName(file.name); setLoading(false);
    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "json") {
      finishParse(parseJSON(await file.text()));
      return;
    }
    if (ext === "csv") {
      finishParse(parseCSV(await file.text()));
      return;
    }
    if (ext === "docx" || ext === "pdf") {
      setLoading(true);
      try {
        setLoadingMsg(ext === "docx" ? "Reading Word document…" : "Reading PDF…");
        const base64 = await fileToBase64(file);
        setLoadingMsg("AI is extracting questions…");
        const result = await parseFileQuestions({ data: { base64, ext } });
        finishParse({ questions: result.questions, errors: [] });
      } catch (err) {
        setStatus({ ok: false, message: `Failed to parse ${ext.toUpperCase()}: ${err.message}` });
      } finally { setLoading(false); }
      return;
    }
    setStatus({ ok: false, message: "Unsupported file. Upload .json, .csv, .docx, or .pdf" });
  }


  function finishParse({ questions, errors }) {
    if (!questions || questions.length === 0) {
      setStatus({ ok: false, message: "No valid questions found.", errors });
      return;
    }
    setPreview({ questions, parseErrors: errors || [] });
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleConfirm() {
    if (!preview) return;
    const { exams, imported, errors } = importQuestionsToExam(examId, preview.questions);
    onImport(exams);
    setPreview(null); setFileName("");
    setStatus({ ok: imported > 0, message: `Imported ${imported} question${imported !== 1 ? "s" : ""}.${errors.length ? ` ${errors.length} row(s) skipped.` : ""}`, errors });
  }

  const TYPE_BADGE = { multiple_choice: "MC", short_answer: "SA", checkbox: "CB" };
  const TYPE_COLOR = { multiple_choice: "bg-blue-100 text-blue-700", short_answer: "bg-purple-100 text-purple-700", checkbox: "bg-amber-100 text-amber-700" };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-primary">Import Questions from File</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload a <strong>.json</strong>, <strong>.csv</strong>, <strong>.docx</strong>, or <strong>.pdf</strong> file. Word and PDF files are parsed by AI automatically.
      </p>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-primary">File format guide ▾</summary>
        <div className="mt-2 space-y-4 rounded-xl bg-muted/50 p-4 text-xs text-muted-foreground">
          <div>
            <p className="font-semibold text-foreground">JSON — all 3 types:</p>
            <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-foreground">{`[
  { "type":"multiple_choice", "text":"Q?", "options":["A","B","C"], "answer":0 },
  { "type":"short_answer",    "text":"Q?", "answer":"Paris" },
  { "type":"checkbox",        "text":"Q?", "options":["A","B","C"], "answers":[0,2] }
]`}</pre>
          </div>
          <div>
            <p className="font-semibold text-foreground">CSV — all 3 types (header row required):</p>
            <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-foreground">{`type,text,option_a,option_b,option_c,option_d,answer
multiple_choice,"What is 2+2?","3","4","5","6",1
short_answer,"Capital of France?",,,,"Paris"
checkbox,"Pick primes","2","3","4","5","0,1,3"`}</pre>
            <p className="mt-1">For checkbox, answer = comma-separated option indices (e.g. 0,2). Add as many option columns as needed.</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">DOCX / PDF — any layout:</p>
            <p>Write questions naturally. AI detects type, options and answers automatically.</p>
          </div>
        </div>
      </details>

      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 transition ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/60"}`}
      >
        <input type="file" accept=".json,.csv,.docx,.pdf" className="sr-only"
          onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ""; }} />
        <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        {loading ? (
          <div className="text-center">
            <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-2 text-sm font-semibold text-primary">{loadingMsg}</p>
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold text-primary">{fileName ? fileName : "Click to browse or drag & drop"}</p>
            <p className="text-xs text-muted-foreground">Supports .json · .csv · .docx · .pdf</p>
          </>
        )}
      </label>

      {preview && (
        <div className="mt-4 rounded-xl border border-border p-4">
          <p className="font-semibold text-foreground">Preview — {preview.questions.length} question{preview.questions.length !== 1 ? "s" : ""} ready to import</p>
          {preview.parseErrors.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-amber-600">{preview.parseErrors.map((e, i) => <li key={i}>⚠ {e}</li>)}</ul>
          )}
          <ul className="mt-3 max-h-56 overflow-y-auto space-y-2 text-sm text-muted-foreground">
            {preview.questions.map((q, i) => {
              const t = q.type || "multiple_choice";
              return (
                <li key={i} className="flex items-start gap-2">
                  <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-bold ${TYPE_COLOR[t] || TYPE_COLOR.multiple_choice}`}>{TYPE_BADGE[t] || "MC"}</span>
                  <span><span className="font-medium text-foreground">{i + 1}.</span> {q.text}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex gap-3">
            <button onClick={handleConfirm} className="btn-gold">Confirm import</button>
            <button onClick={() => { setPreview(null); setFileName(""); }} className="rounded-lg border border-border px-4 py-2 font-semibold hover:bg-muted">Cancel</button>
          </div>
        </div>
      )}

      {status && (
        <div className={`mt-3 rounded-lg p-3 text-sm ${status.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          <p className="font-semibold">{status.message}</p>
          {status.errors && status.errors.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-xs">{status.errors.map((e, i) => <li key={i}>• {e}</li>)}</ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PollsManager ─────────────────────────────────────────────────────────────
function PollsManager() {
  const [polls, setPolls] = useState(getPolls());
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["","","",""]);
  const [editingId, setEditingId] = useState(null);

  function resetForm() { setQuestion(""); setOptions(["","","",""]); setEditingId(null); }

  function handleSubmit(e) {
    e.preventDefault();
    const cleaned = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || cleaned.length < 2) return;
    const payload = { question: question.trim(), options: cleaned };
    setPolls([...(editingId ? updatePoll(editingId, payload) : addPoll(payload))]);
    resetForm();
  }

  function handleEdit(p) {
    setEditingId(p.id); setQuestion(p.question);
    const labels = p.options.map((o) => o.label);
    while (labels.length < 4) labels.push("");
    setOptions(labels);
    window.scrollTo({ top:0, behavior:"smooth" });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">{editingId ? "Edit Poll" : "Add a Poll"}</h2>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Poll question" className="mt-4 w-full rounded-lg border border-border px-4 py-2.5" />
        <div className="mt-4 space-y-2">
          {options.map((opt,i) => (
            <input key={i} value={opt} onChange={(e) => { const next=[...options]; next[i]=e.target.value; setOptions(next); }}
              placeholder={`Option ${String.fromCharCode(65+i)}`} className="w-full rounded-lg border border-border px-4 py-2" />
          ))}
        </div>
        <div className="mt-4 flex gap-3">
          <button type="submit" className="btn-gold">{editingId ? "Save changes" : "Add poll"}</button>
          {editingId && <button type="button" onClick={resetForm} className="rounded-lg border border-border px-4 py-2 font-semibold hover:bg-muted">Cancel</button>}
        </div>
      </form>
      <div className="space-y-4">
        {polls.map((p) => {
          const total = p.options.reduce((a,o) => a+o.votes, 0);
          const labelFor = (oid) => (p.options.find((x) => x.id===oid)||{}).label||"—";
          const voters = (p.voters||[]).slice().reverse();
          return (
            <div key={p.id} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-foreground">{p.question}</p>
                  <p className="text-xs text-muted-foreground">{total} total votes</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => handleEdit(p)} className="rounded-lg border border-primary px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/10">Edit</button>
                  <button onClick={() => { if (window.confirm("Delete this poll?")) setPolls([...removePoll(p.id)]); }} className="rounded-lg border border-destructive px-3 py-1.5 text-sm font-semibold text-destructive hover:bg-destructive/10">Remove</button>
                </div>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">{p.options.map((o) => <li key={o.id}>{o.label} — {o.votes} votes</li>)}</ul>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-primary">Who voted ({voters.length})</summary>
                {voters.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No votes yet.</p> : (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead><tr className="border-b border-border text-muted-foreground"><th className="py-1.5 pr-4">Voter</th><th className="py-1.5 pr-4">Choice</th><th className="py-1.5">When</th></tr></thead>
                      <tbody>{voters.map((v,i) => <tr key={i} className="border-b border-border/60"><td className="py-1.5 pr-4 font-medium text-foreground">{v.voter}</td><td className="py-1.5 pr-4">{labelFor(v.optionId)}</td><td className="py-1.5 text-muted-foreground">{new Date(v.at).toLocaleString()}</td></tr>)}</tbody>
                    </table>
                  </div>
                )}
              </details>
            </div>
          );
        })}
        {polls.length === 0 && <p className="text-muted-foreground">No polls yet. Add one above.</p>}
      </div>
    </div>
  );
}

// ─── ResultsView ──────────────────────────────────────────────────────────────
function ResultsView() {
  const [results, setResults] = useState(getResults());
  const sorted = [...results].sort((a,b) => new Date(b.at)-new Date(a.at));
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary">Exam Results ({results.length})</h2>
        {results.length > 0 && <button onClick={() => { clearResults(); setResults([]); }} className="rounded-lg border border-destructive px-3 py-1.5 text-sm font-semibold text-destructive hover:bg-destructive/10">Clear all</button>}
      </div>
      {results.length === 0 ? <p className="mt-4 text-muted-foreground">No results recorded yet.</p> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-border text-muted-foreground"><th className="py-2 pr-4">Student</th><th className="py-2 pr-4">Exam</th><th className="py-2 pr-4">Score</th><th className="py-2 pr-4">Percent</th><th className="py-2">Date</th></tr></thead>
            <tbody>{sorted.map((r,i) => <tr key={i} className="border-b border-border/60"><td className="py-2 pr-4 font-medium text-foreground">{r.student||"Anonymous"}</td><td className="py-2 pr-4 text-foreground">{r.examTitle}</td><td className="py-2 pr-4">{r.score}/{r.total}</td><td className="py-2 pr-4">{r.percent}%</td><td className="py-2 text-muted-foreground">{new Date(r.at).toLocaleString()}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── SettingsManager ──────────────────────────────────────────────────────────
function SettingsManager() {
  const creds = getAdminCreds();
  const [username, setUsername] = useState(creds.username);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function handleSave(e) {
    e.preventDefault(); setMessage(""); setError("");
    if (!username.trim()) { setError("Username cannot be empty."); return; }
    if (!password) { setError("Enter a new password."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setAdminCreds(username, password);
    setPassword(""); setConfirm(""); setMessage("Admin credentials updated.");
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-primary">Admin Credentials</h2>
      <p className="mt-1 text-sm text-muted-foreground">Change the admin username and password used to sign in.</p>
      <form onSubmit={handleSave} className="mt-4 max-w-md space-y-4">
        <div>
          <label className="block text-sm font-semibold text-primary">Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="mt-2 w-full rounded-lg border border-border px-4 py-2.5" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-primary">New password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter new password" className="mt-2 w-full rounded-lg border border-border px-4 py-2.5" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-primary">Confirm password</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter new password" className="mt-2 w-full rounded-lg border border-border px-4 py-2.5" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm text-success">{message}</p>}
        <button type="submit" className="btn-gold">Save credentials</button>
      </form>
    </div>
  );
}
