import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import NavBar from "../components/NavBar.jsx";
import { useAuth } from "../lib/AuthContext.jsx";
import { parseFileQuestions } from "../lib/api/parse-file.functions";
import {
  listExams, getExam, createExam, deleteExam,
  listQuestionsForExam, createQuestion, updateQuestionRow, deleteQuestion, bulkInsertQuestions,
  listAllAttempts, clearAllAttempts, getQuestionStats,
  listPolls, listVoteCounts, listVoters, createPoll, updatePoll, deletePoll,
} from "../lib/db.js";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — QuizPoll" },
      { name: "description", content: "Manage exams and review results." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

// ─── Shell ────────────────────────────────────────────────────────────────────
function AdminPage() {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [tab, setTab] = useState("dashboard");

  if (loading) return (
    <div className="min-h-screen bg-background"><NavBar />
      <main className="mx-auto max-w-md px-5 py-20 text-center text-muted-foreground">Loading…</main>
    </div>
  );

  if (!isAdmin) return (
    <div className="min-h-screen bg-background"><NavBar />
      <main className="mx-auto max-w-md px-5 py-20 text-center">
        <h1 className="text-2xl font-bold text-primary">Admin access required</h1>
        <p className="mt-3 text-muted-foreground">Please sign in as an admin to continue.</p>
        <button onClick={() => navigate({ to: "/login" })} className="btn-gold mt-6 inline-block">Go to login</button>
      </main>
    </div>
  );

  const TABS = [["dashboard","Dashboard"],["subjects","Subjects"],["questions","Questions"],["polls","Polls"],["results","Results"],["settings","Settings"]];

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <section className="gradient-blue-amber py-10 text-center text-white">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="mt-2">Manage questions, polls and review performance.</p>
      </section>
      <main className="mx-auto max-w-5xl px-5 py-10">
        <div className="mb-8 flex flex-wrap gap-2">
          {TABS.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`rounded-lg px-4 py-2 font-semibold transition ${tab === id ? "btn-gold" : "border border-border hover:bg-muted"}`}>
              {label}
            </button>
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
const DIFF_COLOR = { Easy: "#16a34a", Medium: "#b45309", Hard: "#dc2626" };

function Dashboard() {
  const [results, setResults] = useState([]);
  const [stats,   setStats]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listAllAttempts(), getQuestionStats()])
      .then(([r, s]) => {
        if (cancelled) return;
        setResults(r); setStats(s);
        setSelectedExam((prev) => prev || (s[0]?.examId ?? ""));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p className="text-muted-foreground">Loading dashboard…</p>;

  const examAverages = stats.map((s) => {
    const rs  = results.filter((r) => r.exam_id === s.examId);
    const avg = rs.length ? Math.round(rs.reduce((a, r) => a + r.percent, 0) / rs.length) : 0;
    return { name: s.title, average: avg, attempts: rs.length };
  });

  const current       = stats.find((s) => s.examId === selectedExam) || stats[0];
  const diffData      = (current?.questions || [])
    .filter((q) => q.correctRate !== null)
    .map((q, i) => ({ name: "Q" + (i + 1), text: q.text, rate: q.correctRate, diff: q.difficulty }));
  const totalAttempts = results.length;
  const overallAvg    = results.length ? Math.round(results.reduce((a, r) => a + r.percent, 0) / results.length) : 0;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        {[["Total Attempts", totalAttempts], ["Average Score", overallAvg + "%"], ["Active Exams", stats.length]].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{l}</p>
            <p className="mt-2 text-4xl font-bold text-primary">{v}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">Average Score by Exam</h2>
        {examAverages.length === 0 ? <p className="mt-3 text-muted-foreground">No data yet.</p> : (
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={examAverages}><CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" /><YAxis domain={[0,100]} unit="%" /><Tooltip />
                <Bar dataKey="average" fill="#2948a8" radius={[6,6,0,0]} />
              </BarChart>
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
        {diffData.length === 0 ? <p className="mt-3 text-muted-foreground">No answered questions yet.</p> : (
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={diffData}><CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" /><YAxis domain={[0,100]} unit="%" />
                <Tooltip formatter={(v,_,p) => [v+"% correct", p.payload.diff]} labelFormatter={(l,p) => p[0]?.payload.text || l} />
                <Bar dataKey="rate" radius={[6,6,0,0]}>{diffData.map((d,i) => <Cell key={i} fill={DIFF_COLOR[d.diff] || "#2948a8"} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SubjectsManager ──────────────────────────────────────────────────────────
function SubjectsManager() {
  const [exams,   setExams]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [title,   setTitle]   = useState("");
  const [desc,    setDesc]    = useState("");
  const [minutes, setMinutes] = useState(5);

  useEffect(() => {
    listExams().then(setExams).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await createExam({ title, description: desc, minutes });
      setExams(await listExams());
      setTitle(""); setDesc(""); setMinutes(5);
    } catch (e) { setError(e.message); }
  }

  async function handleRemove(id) {
    if (!window.confirm("Delete this subject and all its questions?")) return;
    try { await deleteExam(id); setExams(await listExams()); } catch (e) { setError(e.message); }
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <form onSubmit={handleAdd} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">Add a Subject</h2>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Subject title" className="mt-4 w-full rounded-lg border border-border px-4 py-2.5" />
        <input value={desc}  onChange={(e) => setDesc(e.target.value)}  placeholder="Short description" className="mt-3 w-full rounded-lg border border-border px-4 py-2.5" />
        <div className="mt-3 flex items-center gap-3">
          <label className="text-sm font-semibold text-primary">Time limit (minutes)</label>
          <input type="number" min="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} className="w-24 rounded-lg border border-border px-3 py-2" />
        </div>
        <button type="submit" className="btn-gold mt-4">Add subject</button>
      </form>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">Subjects ({exams.length})</h2>
        {loading ? <p className="mt-3 text-muted-foreground">Loading…</p> : (
          <div className="mt-4 space-y-3">
            {exams.map((ex) => (
              <div key={ex.id} className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
                <div>
                  <p className="font-medium">{ex.title}</p>
                  <p className="text-sm text-muted-foreground">{ex.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{ex.questionCount} questions · {ex.minutes} min</p>
                </div>
                <button onClick={() => handleRemove(ex.id)} className="shrink-0 rounded-lg border border-destructive px-3 py-1.5 text-sm font-semibold text-destructive hover:bg-destructive/10">Remove</button>
              </div>
            ))}
            {exams.length === 0 && <p className="text-muted-foreground">No subjects yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── QuestionsManager ─────────────────────────────────────────────────────────
const QTYPE_BADGE  = { multiple_choice: "MC", short_answer: "SA", checkbox: "CB" };
const QTYPE_COLOR  = { multiple_choice: "bg-blue-100 text-blue-700", short_answer: "bg-purple-100 text-purple-700", checkbox: "bg-amber-100 text-amber-700" };

function QuestionsManager() {
  const [exams,     setExams]     = useState([]);
  const [questions, setQuestions] = useState([]);
  const [examId,    setExamId]    = useState("");
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  const [qType,       setQType]       = useState("multiple_choice");
  const [text,        setText]        = useState("");
  const [options,     setOptions]     = useState(["","","",""]);
  const [answer,      setAnswer]      = useState(0);
  const [checkAns,    setCheckAns]    = useState([]);
  const [shortAnswer, setShortAnswer] = useState("");
  const [editingId,   setEditingId]   = useState(null);

  useEffect(() => {
    listExams()
      .then((data) => { setExams(data); setExamId((p) => p || data[0]?.id || ""); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!examId) return;
    listQuestionsForExam(examId).then(setQuestions).catch((e) => setError(e.message));
  }, [examId]);

  function resetForm() { setText(""); setOptions(["","","",""]); setAnswer(0); setCheckAns([]); setShortAnswer(""); setEditingId(null); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim() || !examId) return;
    let payload;
    if (qType === "short_answer") {
      payload = { type: "short_answer", text: text.trim(), answer: shortAnswer.trim() };
    } else if (qType === "checkbox") {
      const opts = options.map((o) => o.trim()).filter(Boolean);
      if (opts.length < 2) { setError("Need at least 2 options."); return; }
      payload = { type: "checkbox", text: text.trim(), options: opts, answers: checkAns };
    } else {
      const opts = options.map((o) => o.trim()).filter(Boolean);
      if (opts.length < 2) { setError("Need at least 2 options."); return; }
      payload = { type: "multiple_choice", text: text.trim(), options: opts, answer: Math.min(answer, opts.length - 1) };
    }
    try {
      if (editingId) {
        const updated = await updateQuestionRow(editingId, payload);
        setQuestions((qs) => qs.map((q) => q.id === editingId ? updated : q));
      } else {
        const created = await createQuestion(examId, payload);
        setQuestions((qs) => [...qs, created]);
      }
      resetForm(); setError("");
    } catch (e) { setError(e.message); }
  }

  function handleEdit(q) {
    setEditingId(q.id); setText(q.text);
    const t = q.type || "multiple_choice"; setQType(t);
    if (t === "short_answer") { setShortAnswer(q.answer || ""); }
    else if (t === "checkbox") { const p = [...(q.options||[])]; while(p.length<4)p.push(""); setOptions(p); setCheckAns(q.answers||[]); }
    else { const p = [...(q.options||[])]; while(p.length<4)p.push(""); setOptions(p); setAnswer(q.answer||0); }
    window.scrollTo({ top:0, behavior:"smooth" });
  }

  async function handleRemove(q) {
    try {
      await deleteQuestion(q.id);
      setQuestions((qs) => qs.filter((x) => x.id !== q.id));
      if (editingId === q.id) resetForm();
    } catch (e) { setError(e.message); }
  }

  function toggleCheck(i) { setCheckAns((p) => p.includes(i) ? p.filter((x)=>x!==i) : [...p,i]); }

  if (loading) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="flex items-center gap-3">
        <label className="text-sm font-semibold text-primary">Exam</label>
        <select value={examId} onChange={(e) => { setExamId(e.target.value); resetForm(); }} className="rounded-lg border border-border px-3 py-2 text-sm">
          {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
        </select>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">{editingId ? "Edit Question" : "Add a Question"}</h2>
        <div className="mt-4 flex gap-2">
          {[["multiple_choice","Multiple Choice"],["short_answer","Short Answer"],["checkbox","Checkbox"]].map(([v,l]) => (
            <button key={v} type="button" onClick={() => { setQType(v); setCheckAns([]); }}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${qType===v ? "btn-gold" : "border-border hover:bg-muted"}`}>{l}</button>
          ))}
        </div>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Question text" className="mt-4 w-full rounded-lg border border-border px-4 py-2.5" />

        {qType === "short_answer" && (
          <div className="mt-4">
            <label className="text-sm font-semibold text-primary">Expected answer (for auto-grading)</label>
            <input value={shortAnswer} onChange={(e) => setShortAnswer(e.target.value)} placeholder="Correct answer text" className="mt-2 w-full rounded-lg border border-border px-4 py-2.5" />
            <p className="mt-1 text-xs text-muted-foreground">Case-insensitive. Leave blank = manually graded.</p>
          </div>
        )}

        {(qType === "multiple_choice" || qType === "checkbox") && (
          <div className="mt-4 space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                {qType === "multiple_choice"
                  ? <input type="radio" name="correct" checked={answer===i} onChange={() => setAnswer(i)} className="shrink-0" title="Correct answer" />
                  : <input type="checkbox" checked={checkAns.includes(i)} onChange={() => toggleCheck(i)} className="shrink-0" title="Correct answer" />}
                <input value={opt} onChange={(e) => { const n=[...options]; n[i]=e.target.value; setOptions(n); }}
                  placeholder={`Option ${String.fromCharCode(65+i)}`} className="w-full rounded-lg border border-border px-4 py-2" />
                {options.length > 2 && (
                  <button type="button" onClick={() => {
                    const n = options.filter((_,j)=>j!==i);
                    setOptions(n);
                    if (qType==="multiple_choice" && answer>=n.length) setAnswer(n.length-1);
                    if (qType==="checkbox") setCheckAns((p)=>p.filter((x)=>x!==i).map((x)=>x>i?x-1:x));
                  }} className="shrink-0 rounded-lg border border-destructive px-2 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10" title="Remove option">✕</button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setOptions((o)=>[...o,""])}
              className="mt-1 rounded-lg border border-dashed border-primary px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/5">+ Add option</button>
            <p className="text-xs text-muted-foreground">
              {qType==="multiple_choice" ? "Select the radio next to the correct answer." : "Check all correct answers."}
            </p>
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <button type="submit" className="btn-gold">{editingId ? "Save changes" : "Add question"}</button>
          {editingId && <button type="button" onClick={resetForm} className="rounded-lg border border-border px-4 py-2 font-semibold hover:bg-muted">Cancel</button>}
        </div>
      </form>

      {examId && <ImportQuestions examId={examId} onImport={(qs) => setQuestions(qs)} />}

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">Questions ({questions.length})</h2>
        <div className="mt-4 space-y-3">
          {questions.map((q, i) => {
            const t = q.type || "multiple_choice";
            return (
              <div key={q.id} className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-bold ${QTYPE_COLOR[t]}`}>{QTYPE_BADGE[t]}</span>
                    <p className="font-medium">{i+1}. {q.text}</p>
                  </div>
                  {t==="short_answer" && <p className="mt-1 text-sm text-muted-foreground">Answer: <span className="font-medium text-foreground">{q.answer||<em>manually graded</em>}</span></p>}
                  {(t==="multiple_choice"||t==="checkbox") && (
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {(q.options||[]).map((o,oi) => {
                        const correct = t==="multiple_choice" ? oi===q.answer : (q.answers||[]).includes(oi);
                        return <li key={oi} className={correct ? "font-semibold text-green-700" : ""}>{String.fromCharCode(65+oi)}. {o}{correct?" ✓":""}</li>;
                      })}
                    </ul>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <button onClick={() => handleEdit(q)} className="rounded-lg border border-primary px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/10">Edit</button>
                  <button onClick={() => handleRemove(q)} className="rounded-lg border border-destructive px-3 py-1.5 text-sm font-semibold text-destructive hover:bg-destructive/10">Remove</button>
                </div>
              </div>
            );
          })}
          {questions.length===0 && <p className="text-muted-foreground">No questions yet. Add one above.</p>}
        </div>
      </div>
    </div>
  );
}

// ─── ImportQuestions ──────────────────────────────────────────────────────────
function ImportQuestions({ examId, onImport }) {
  const [dragOver,    setDragOver]    = useState(false);
  const [status,      setStatus]      = useState(null);
  const [preview,     setPreview]     = useState(null);
  const [fileName,    setFileName]    = useState("");
  const [loading,     setLoading]     = useState(false);
  const [loadingMsg,  setLoadingMsg]  = useState("");

  function parseJSON(text) {
    try {
      const d = JSON.parse(text);
      if (!Array.isArray(d)) return { questions:[], errors:["JSON must be an array."] };
      return { questions:d, errors:[] };
    } catch(e) { return { questions:[], errors:["Invalid JSON: "+e.message] }; }
  }

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return { questions:[], errors:["CSV has no data rows."] };
    const errors=[], questions=[];
    const headers = lines[0].split(",").map((h)=>h.replace(/^"|"$/g,"").trim().toLowerCase());
    const typeIdx=headers.indexOf("type"), textIdx=headers.indexOf("text"), ansIdx=headers.lastIndexOf("answer");
    const optCols=headers.reduce((a,h,i)=>{ if(i!==typeIdx&&i!==textIdx&&i!==ansIdx&&h.startsWith("option"))a.push(i); return a; },[]);
    const clean=(s)=>(s||"").replace(/^"|"$/g,"").trim();

    for (let i=1;i<lines.length;i++) {
      const cols=[]; let cur="",inQ=false;
      for(const ch of lines[i]+",") {
        if(ch==='"'){inQ=!inQ;}else if(ch===","&&!inQ){cols.push(cur);cur="";}else cur+=ch;
      }
      const type=typeIdx>=0?(clean(cols[typeIdx])||"multiple_choice"):"multiple_choice";
      const qtext=textIdx>=0?clean(cols[textIdx]):clean(cols[0]);
      const ansRaw=ansIdx>=0?clean(cols[ansIdx]):"";
      if(!qtext){errors.push(`Row ${i+1}: empty text.`);continue;}
      if(type==="short_answer"){questions.push({type:"short_answer",text:qtext,answer:ansRaw});continue;}
      const opts=optCols.map((ci)=>clean(cols[ci])).filter(Boolean);
      if(opts.length<2){errors.push(`Row ${i+1}: need at least 2 options.`);continue;}
      if(type==="checkbox"){
        const answers=ansRaw.split(",").map((x)=>parseInt(x.trim(),10)).filter((n)=>!isNaN(n)&&n>=0&&n<opts.length);
        questions.push({type:"checkbox",text:qtext,options:opts,answers});
      } else {
        const ans=parseInt(ansRaw,10);
        if(isNaN(ans)||ans<0||ans>=opts.length){errors.push(`Row ${i+1}: answer index out of range.`);continue;}
        questions.push({type:"multiple_choice",text:qtext,options:opts,answer:ans});
      }
    }
    return { questions, errors };
  }

  async function fileToBase64(file) {
    return new Promise((res,rej)=>{
      const r=new FileReader();
      r.onload=()=>res(r.result.split(",")[1]);
      r.onerror=()=>rej(new Error("Could not read file"));
      r.readAsDataURL(file);
    });
  }

  async function handleFile(file) {
    if (!file) return;
    setStatus(null); setPreview(null); setFileName(file.name);
    const ext=file.name.split(".").pop().toLowerCase();
    if (ext==="json") { finishParse(parseJSON(await file.text())); return; }
    if (ext==="csv")  { finishParse(parseCSV(await file.text()));  return; }
    if (ext==="docx"||ext==="pdf") {
      setLoading(true);
      try {
        setLoadingMsg(ext==="docx"?"Reading Word document…":"Reading PDF…");
        const base64=await fileToBase64(file);
        setLoadingMsg("AI is extracting questions…");
        const result=await parseFileQuestions({ data:{base64,ext} });
        finishParse({questions:result.questions,errors:[]});
      } catch(e) { setStatus({ok:false,message:`Failed to parse ${ext.toUpperCase()}: ${e.message}`}); }
      finally { setLoading(false); }
      return;
    }
    setStatus({ok:false,message:"Unsupported file. Upload .json, .csv, .docx, or .pdf"});
  }

  function finishParse({questions,errors}) {
    if (!questions?.length) { setStatus({ok:false,message:"No valid questions found.",errors}); return; }
    setPreview({questions,parseErrors:errors||[]});
  }

  async function handleConfirm() {
    if (!preview) return;
    try {
      const {imported,errors}=await bulkInsertQuestions(examId,preview.questions);
      const fresh=await listQuestionsForExam(examId);
      onImport(fresh);
      setPreview(null); setFileName("");
      setStatus({ok:imported>0,message:`Imported ${imported} question${imported!==1?"s":""}.${errors.length?` ${errors.length} row(s) skipped.`:""}`,errors});
    } catch(e) { setStatus({ok:false,message:`Import failed: ${e.message}`}); }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-primary">Import Questions from File</h2>
      <p className="mt-1 text-sm text-muted-foreground">Upload a <strong>.json</strong>, <strong>.csv</strong>, <strong>.docx</strong>, or <strong>.pdf</strong>. Word and PDF files are parsed by AI.</p>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-primary">File format guide ▾</summary>
        <div className="mt-2 space-y-3 rounded-xl bg-muted/50 p-4 text-xs text-muted-foreground">
          <div><p className="font-semibold text-foreground">JSON array:</p>
            <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-foreground">{`[
  {"type":"multiple_choice","text":"Q?","options":["A","B","C"],"answer":0},
  {"type":"short_answer","text":"Q?","answer":"Paris"},
  {"type":"checkbox","text":"Q?","options":["A","B","C"],"answers":[0,2]}
]`}</pre></div>
          <div><p className="font-semibold text-foreground">CSV (header row required):</p>
            <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-foreground">{`type,text,option_a,option_b,option_c,answer
multiple_choice,"What is 2+2?","3","4","5",1
short_answer,"Capital of France?",,,"Paris"
checkbox,"Pick primes","2","3","4","0,1"`}</pre></div>
        </div>
      </details>

      <label onDragOver={(e)=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)}
        onDrop={(e)=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(f)handleFile(f);}}
        className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 transition ${dragOver?"border-primary bg-primary/5":"border-border hover:border-primary/60"}`}>
        <input type="file" accept=".json,.csv,.docx,.pdf" className="sr-only" onChange={(e)=>{if(e.target.files[0])handleFile(e.target.files[0]);e.target.value="";}} />
        {loading ? (
          <div className="text-center">
            <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-2 text-sm font-semibold text-primary">{loadingMsg}</p>
          </div>
        ) : (
          <>
            <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
            <p className="text-sm font-semibold text-primary">{fileName || "Click to browse or drag & drop"}</p>
            <p className="text-xs text-muted-foreground">Supports .json · .csv · .docx · .pdf</p>
          </>
        )}
      </label>

      {preview && (
        <div className="mt-4 rounded-xl border border-border p-4">
          <p className="font-semibold">{preview.questions.length} question{preview.questions.length!==1?"s":""} ready to import</p>
          {preview.parseErrors.length>0 && <ul className="mt-2 space-y-1 text-xs text-amber-600">{preview.parseErrors.map((e,i)=><li key={i}>⚠ {e}</li>)}</ul>}
          <ul className="mt-3 max-h-56 overflow-y-auto space-y-2 text-sm text-muted-foreground">
            {preview.questions.map((q,i)=>{
              const t=q.type||"multiple_choice";
              return <li key={i} className="flex items-start gap-2"><span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-bold ${QTYPE_COLOR[t]||QTYPE_COLOR.multiple_choice}`}>{QTYPE_BADGE[t]||"MC"}</span><span><span className="font-medium text-foreground">{i+1}.</span> {q.text}</span></li>;
            })}
          </ul>
          <div className="mt-4 flex gap-3">
            <button onClick={handleConfirm} className="btn-gold">Confirm import</button>
            <button onClick={()=>{setPreview(null);setFileName("");}} className="rounded-lg border border-border px-4 py-2 font-semibold hover:bg-muted">Cancel</button>
          </div>
        </div>
      )}

      {status && (
        <div className={`mt-3 rounded-lg p-3 text-sm ${status.ok?"bg-green-50 text-green-700":"bg-red-50 text-red-700"}`}>
          <p className="font-semibold">{status.message}</p>
          {status.errors?.length>0 && <ul className="mt-1 space-y-0.5 text-xs">{status.errors.map((e,i)=><li key={i}>• {e}</li>)}</ul>}
        </div>
      )}
    </div>
  );
}

// ─── PollsManager ─────────────────────────────────────────────────────────────
function PollsManager() {
  const [polls,     setPolls]     = useState([]);
  const [counts,    setCounts]    = useState({});
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [question,  setQuestion]  = useState("");
  const [options,   setOptions]   = useState(["","","",""]);
  const [editingId, setEditingId] = useState(null);
  const [votersMap, setVotersMap] = useState({});

  async function load() {
    const [ps, cs] = await Promise.all([listPolls(), listVoteCounts()]);
    setPolls(ps); setCounts(cs);
  }

  useEffect(() => {
    load().catch((e)=>setError(e.message)).finally(()=>setLoading(false));
  }, []);

  async function loadVoters(pollId) {
    if (votersMap[pollId]) return;
    try {
      const v = await listVoters(pollId);
      setVotersMap((m) => ({...m, [pollId]: v}));
    } catch(e) { setError(e.message); }
  }

  function resetForm() { setQuestion(""); setOptions(["","","",""]); setEditingId(null); }

  async function handleSubmit(e) {
    e.preventDefault();
    const cleaned=options.map((o)=>o.trim()).filter(Boolean);
    if (!question.trim()||cleaned.length<2) return;
    try {
      if (editingId) { await updatePoll(editingId,{question:question.trim(),options:cleaned}); }
      else { await createPoll({question:question.trim(),options:cleaned}); }
      await load(); resetForm();
    } catch(e) { setError(e.message); }
  }

  function handleEdit(p) {
    setEditingId(p.id); setQuestion(p.question);
    const labels=p.options.map((o)=>o.label);
    while(labels.length<4)labels.push("");
    setOptions(labels);
    window.scrollTo({top:0,behavior:"smooth"});
  }

  async function handleRemove(id) {
    if (!window.confirm("Delete this poll?")) return;
    try { await deletePoll(id); await load(); } catch(e) { setError(e.message); }
  }

  if (loading) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">{editingId?"Edit Poll":"Add a Poll"}</h2>
        <input value={question} onChange={(e)=>setQuestion(e.target.value)} placeholder="Poll question" className="mt-4 w-full rounded-lg border border-border px-4 py-2.5" />
        <div className="mt-4 space-y-2">
          {options.map((opt,i)=>(
            <input key={i} value={opt} onChange={(e)=>{const n=[...options];n[i]=e.target.value;setOptions(n);}} placeholder={`Option ${String.fromCharCode(65+i)}`} className="w-full rounded-lg border border-border px-4 py-2" />
          ))}
        </div>
        <div className="mt-4 flex gap-3">
          <button type="submit" className="btn-gold">{editingId?"Save changes":"Add poll"}</button>
          {editingId && <button type="button" onClick={resetForm} className="rounded-lg border border-border px-4 py-2 font-semibold hover:bg-muted">Cancel</button>}
        </div>
      </form>
      <div className="space-y-4">
        {polls.map((p)=>{
          const total=(p.options||[]).reduce((a,o)=>a+(counts[o.id]||0),0);
          return (
            <div key={p.id} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">{p.question}</p>
                  <p className="text-xs text-muted-foreground">{total} total votes</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={()=>handleEdit(p)} className="rounded-lg border border-primary px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/10">Edit</button>
                  <button onClick={()=>handleRemove(p.id)} className="rounded-lg border border-destructive px-3 py-1.5 text-sm font-semibold text-destructive hover:bg-destructive/10">Remove</button>
                </div>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {(p.options||[]).map((o)=><li key={o.id}>{o.label} — {counts[o.id]||0} votes</li>)}
              </ul>
              <details onToggle={(e)=>{ if(e.target.open) loadVoters(p.id); }}>
                <summary className="mt-3 cursor-pointer text-sm font-semibold text-primary">Who voted</summary>
                {votersMap[p.id] ? (
                  votersMap[p.id].length===0 ? <p className="mt-2 text-sm text-muted-foreground">No votes yet.</p> : (
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead><tr className="border-b border-border text-muted-foreground"><th className="py-1.5 pr-4">Voter</th><th className="py-1.5 pr-4">Choice</th><th className="py-1.5">When</th></tr></thead>
                        <tbody>{votersMap[p.id].map((v,i)=><tr key={i} className="border-b border-border/60"><td className="py-1.5 pr-4 font-medium">{v.voter}</td><td className="py-1.5 pr-4">{v.optionLabel}</td><td className="py-1.5 text-muted-foreground">{new Date(v.at).toLocaleString()}</td></tr>)}</tbody>
                      </table>
                    </div>
                  )
                ) : <p className="mt-2 text-sm text-muted-foreground">Loading…</p>}
              </details>
            </div>
          );
        })}
        {polls.length===0 && <p className="text-muted-foreground">No polls yet.</p>}
      </div>
    </div>
  );
}

// ─── ResultsView ──────────────────────────────────────────────────────────────
function ResultsView() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    listAllAttempts().then(setResults).catch((e)=>setError(e.message)).finally(()=>setLoading(false));
  }, []);

  async function handleClear() {
    if (!window.confirm("Delete ALL results? This cannot be undone.")) return;
    try { await clearAllAttempts(); setResults([]); } catch(e) { setError(e.message); }
  }

  if (loading) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary">Exam Results ({results.length})</h2>
        {results.length>0 && <button onClick={handleClear} className="rounded-lg border border-destructive px-3 py-1.5 text-sm font-semibold text-destructive hover:bg-destructive/10">Clear all</button>}
      </div>
      {results.length===0 ? <p className="mt-4 text-muted-foreground">No results yet.</p> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-border text-muted-foreground"><th className="py-2 pr-4">Student</th><th className="py-2 pr-4">Exam</th><th className="py-2 pr-4">Score</th><th className="py-2 pr-4">Percent</th><th className="py-2">Date</th></tr></thead>
            <tbody>{[...results].sort((a,b)=>new Date(b.submitted_at)-new Date(a.submitted_at)).map((r,i)=>(
              <tr key={i} className="border-b border-border/60">
                <td className="py-2 pr-4 font-medium">{r.studentName}</td>
                <td className="py-2 pr-4">{r.examTitle}</td>
                <td className="py-2 pr-4">{r.score}/{r.total}</td>
                <td className="py-2 pr-4">{r.percent}%</td>
                <td className="py-2 text-muted-foreground">{new Date(r.submitted_at).toLocaleString()}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── SettingsManager ──────────────────────────────────────────────────────────
function SettingsManager() {
  const { username: currentUsername, updateUsername, updatePassword } = useAuth();

  const [username,    setUsername]    = useState(currentUsername || "");
  const [usernameMsg, setUsernameMsg] = useState("");
  const [usernameErr, setUsernameErr] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);

  const [password,    setPassword]    = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordErr, setPasswordErr] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  async function handleUsernameSave(e) {
    e.preventDefault(); setUsernameMsg(""); setUsernameErr("");
    setUsernameSaving(true);
    const res = await updateUsername(username.trim());
    setUsernameSaving(false);
    if (res.ok) setUsernameMsg("Username updated.");
    else setUsernameErr(res.error);
  }

  async function handlePasswordSave(e) {
    e.preventDefault(); setPasswordMsg(""); setPasswordErr("");
    if (!password) { setPasswordErr("Enter a new password."); return; }
    if (password !== confirm) { setPasswordErr("Passwords do not match."); return; }
    setPasswordSaving(true);
    const res = await updatePassword(password);
    setPasswordSaving(false);
    if (res.ok) { setPassword(""); setConfirm(""); setPasswordMsg("Password updated."); }
    else setPasswordErr(res.error);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">Your Username</h2>
        <form onSubmit={handleUsernameSave} className="mt-4 max-w-md space-y-4">
          <input value={username} onChange={(e)=>setUsername(e.target.value)} className="w-full rounded-lg border border-border px-4 py-2.5" />
          {usernameErr && <p className="text-sm text-destructive">{usernameErr}</p>}
          {usernameMsg && <p className="text-sm text-green-700">{usernameMsg}</p>}
          <button type="submit" disabled={usernameSaving} className="btn-gold disabled:opacity-60">{usernameSaving?"Saving…":"Save username"}</button>
        </form>
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">Change Password</h2>
        <form onSubmit={handlePasswordSave} className="mt-4 max-w-md space-y-4">
          <div>
            <label className="block text-sm font-semibold text-primary">New password</label>
            <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Enter new password" autoComplete="new-password" className="mt-2 w-full rounded-lg border border-border px-4 py-2.5" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-primary">Confirm password</label>
            <input type="password" value={confirm} onChange={(e)=>setConfirm(e.target.value)} placeholder="Re-enter new password" autoComplete="new-password" className="mt-2 w-full rounded-lg border border-border px-4 py-2.5" />
          </div>
          {passwordErr && <p className="text-sm text-destructive">{passwordErr}</p>}
          {passwordMsg && <p className="text-sm text-green-700">{passwordMsg}</p>}
          <button type="submit" disabled={passwordSaving} className="btn-gold disabled:opacity-60">{passwordSaving?"Saving…":"Save password"}</button>
        </form>
      </div>
    </div>
  );
}
