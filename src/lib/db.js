// Async data-access layer backed by Supabase Postgres + RLS, replacing the
// old localStorage-based store.js. Every function here returns a promise;
// callers are responsible for their own loading/error state (most routes
// already had a `mounted`/`ready` pattern from the localStorage days — keep
// using that, just await these instead of reading localStorage synchronously).
import { supabase } from "./supabaseClient";

// ---------------------------------------------------------------------------
// Question payload <-> DB row mapping
//
// UI components work with the original unified shape:
//   multiple_choice: { type, text, options:string[], answer:number }
//   checkbox:        { type, text, options:string[], answers:number[] }
//   short_answer:    { type, text, answer:string }
// The DB stores three separate, properly-typed answer columns instead of one
// jsonb blob (answer_index int, answer_indices int[], answer_text text) —
// these two helpers are the single place that translates between the two.
// ---------------------------------------------------------------------------
function questionToRow(q) {
  const type = q.type || "multiple_choice";
  if (type === "short_answer") {
    return { type, text: q.text.trim(), options: null, answer_index: null, answer_indices: null, answer_text: String(q.answer ?? "").trim() || null };
  }
  const options = (q.options || []).map((o) => String(o).trim()).filter(Boolean);
  if (type === "checkbox") {
    const answers = Array.isArray(q.answers) ? q.answers.map(Number).filter((n) => !isNaN(n) && n >= 0 && n < options.length) : [];
    return { type, text: q.text.trim(), options, answer_index: null, answer_indices: answers, answer_text: null };
  }
  const answer = Number(q.answer);
  return { type, text: q.text.trim(), options, answer_index: isNaN(answer) ? 0 : answer, answer_indices: null, answer_text: null };
}

function rowToQuestion(row) {
  const base = { id: row.id, type: row.type, text: row.text, options: row.options || undefined };
  if (row.type === "short_answer") return { ...base, answer: row.answer_text || "" };
  if (row.type === "checkbox") return { ...base, answers: row.answer_indices || [] };
  return { ...base, answer: row.answer_index ?? 0 };
}

// Validates + maps one imported question (from JSON/CSV/AI). Returns
// { row } on success or { error } on failure — mirrors the original
// store.js importQuestionsToExam() validation rules.
function validateImportedQuestion(q, label) {
  if (!q.text || typeof q.text !== "string" || !q.text.trim()) {
    return { error: `${label}: missing question text.` };
  }
  const type = q.type || "multiple_choice";

  if (type === "short_answer") {
    return { row: questionToRow({ type, text: q.text, answer: q.answer }) };
  }

  if (!Array.isArray(q.options) || q.options.length < 2) {
    return { error: `${label}: need at least 2 options.` };
  }
  const opts = q.options.map((o) => String(o).trim()).filter(Boolean);
  if (opts.length < 2) {
    return { error: `${label}: need at least 2 non-empty options.` };
  }

  if (type === "checkbox") {
    return { row: questionToRow({ type, text: q.text, options: opts, answers: q.answers }) };
  }

  const ans = Number(q.answer);
  if (isNaN(ans) || ans < 0 || ans >= opts.length) {
    return { error: `${label}: answer index ${q.answer} out of range (0–${opts.length - 1}).` };
  }
  return { row: questionToRow({ type: "multiple_choice", text: q.text, options: opts, answer: ans }) };
}

function throwIfError(error, context) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Exams
// ---------------------------------------------------------------------------

export async function listExams() {
  const { data, error } = await supabase
    .from("exams")
    .select("id, title, description, minutes, created_at, questions(count)")
    .order("created_at", { ascending: true });
  throwIfError(error, "Failed to load exams");
  return (data || []).map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    minutes: e.minutes,
    questionCount: e.questions?.[0]?.count ?? 0,
  }));
}

export async function getExam(examId) {
  const { data, error } = await supabase.from("exams").select("*").eq("id", examId).maybeSingle();
  throwIfError(error, "Failed to load exam");
  return data;
}

export async function createExam({ title, description, minutes }) {
  const { data, error } = await supabase
    .from("exams")
    .insert({ title: title.trim(), description: (description || "").trim(), minutes: Number(minutes) > 0 ? Number(minutes) : 5 })
    .select()
    .single();
  throwIfError(error, "Failed to create exam");
  return data;
}

export async function deleteExam(examId) {
  const { error } = await supabase.from("exams").delete().eq("id", examId);
  throwIfError(error, "Failed to delete exam");
}

// ---------------------------------------------------------------------------
// Questions — admin (full row, including answers)
// ---------------------------------------------------------------------------

export async function listQuestionsForExam(examId) {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("exam_id", examId)
    .order("position", { ascending: true });
  throwIfError(error, "Failed to load questions");
  return (data || []).map(rowToQuestion);
}

async function nextPosition(examId) {
  const { count, error } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", examId);
  throwIfError(error, "Failed to compute question position");
  return count ?? 0;
}

export async function createQuestion(examId, payload) {
  const position = await nextPosition(examId);
  const { data, error } = await supabase
    .from("questions")
    .insert({ exam_id: examId, position, ...questionToRow(payload) })
    .select()
    .single();
  throwIfError(error, "Failed to add question");
  return rowToQuestion(data);
}

export async function updateQuestionRow(questionId, payload) {
  const { data, error } = await supabase
    .from("questions")
    .update(questionToRow(payload))
    .eq("id", questionId)
    .select()
    .single();
  throwIfError(error, "Failed to update question");
  return rowToQuestion(data);
}

export async function deleteQuestion(questionId) {
  const { error } = await supabase.from("questions").delete().eq("id", questionId);
  throwIfError(error, "Failed to delete question");
}

// Bulk import (JSON/CSV/AI-extracted questions). Returns { imported, errors }.
export async function bulkInsertQuestions(examId, questions) {
  const startPosition = await nextPosition(examId);
  const errors = [];
  const rows = [];
  (questions || []).forEach((q, i) => {
    const result = validateImportedQuestion(q, `Row ${i + 1}`);
    if (result.error) errors.push(result.error);
    else rows.push({ exam_id: examId, position: startPosition + rows.length, ...result.row });
  });
  if (rows.length === 0) return { imported: 0, errors };
  const { error } = await supabase.from("questions").insert(rows);
  throwIfError(error, "Failed to import questions");
  return { imported: rows.length, errors };
}

// ---------------------------------------------------------------------------
// Questions — student-safe (never includes answer columns; RLS also blocks
// students from the base `questions` table entirely, this view is the only
// path)
// ---------------------------------------------------------------------------

export async function listQuestionsPublic(examId) {
  const { data, error } = await supabase
    .from("questions_public")
    .select("*")
    .eq("exam_id", examId)
    .order("position", { ascending: true });
  throwIfError(error, "Failed to load exam questions");
  return data || [];
}

// ---------------------------------------------------------------------------
// Exam attempts (results)
// ---------------------------------------------------------------------------

export async function getMyAttempt(examId, userId) {
  const { data, error } = await supabase
    .from("exam_attempts")
    .select("*")
    .eq("exam_id", examId)
    .eq("student_id", userId)
    .maybeSingle();
  throwIfError(error, "Failed to check previous attempt");
  return data;
}

// answers: { [questionId]: number | number[] | string }
export async function submitAttempt(examId, answers) {
  const { data, error } = await supabase.rpc("submit_exam_attempt", {
    p_exam_id: examId,
    p_answers: answers,
  });
  throwIfError(error, "Failed to submit exam");
  // RPCs returning `table(...)` come back as an array of one row.
  return Array.isArray(data) ? data[0] : data;
}

export async function listAllAttempts() {
  const { data, error } = await supabase
    .from("exam_attempts")
    .select("*, profiles(username), exams(title)")
    .order("submitted_at", { ascending: false });
  throwIfError(error, "Failed to load results");
  return (data || []).map((r) => ({
    ...r,
    studentName: r.profiles?.username || "Unknown",
    examTitle: r.exams?.title || "Unknown exam",
  }));
}

export async function clearAllAttempts() {
  const { error } = await supabase.from("exam_attempts").delete().not("id", "is", null);
  throwIfError(error, "Failed to clear results");
}

// Difficulty/correct-rate stats per question, across all recorded attempts —
// same shape the original admin Dashboard expected.
export async function getQuestionStats() {
  const [exams, attempts] = await Promise.all([listExams(), listAllAttempts()]);
  const stats = [];
  for (const exam of exams) {
    const { data: questionRows, error } = await supabase
      .from("questions")
      .select("id, text")
      .eq("exam_id", exam.id)
      .order("position", { ascending: true });
    throwIfError(error, "Failed to load question stats");
    const examAttempts = attempts.filter((a) => a.exam_id === exam.id);
    const questions = (questionRows || []).map((q) => {
      let attemptCount = 0;
      let correct = 0;
      for (const a of examAttempts) {
        const result = a.per_question ? a.per_question[q.id] : undefined;
        if (result === undefined || result === null) continue;
        attemptCount += 1;
        if (result === true) correct += 1;
      }
      const correctRate = attemptCount ? Math.round((correct / attemptCount) * 100) : null;
      let difficulty = "No data";
      if (correctRate !== null) {
        difficulty = correctRate >= 70 ? "Easy" : correctRate >= 40 ? "Medium" : "Hard";
      }
      return { id: q.id, text: q.text, attempts: attemptCount, correctRate, difficulty };
    });
    stats.push({ examId: exam.id, title: exam.title, questions });
  }
  return stats;
}

// ---------------------------------------------------------------------------
// Polls
// ---------------------------------------------------------------------------

export async function listPolls() {
  const { data, error } = await supabase
    .from("polls")
    .select("*, poll_options(id, label, position)")
    .order("created_at", { ascending: true });
  throwIfError(error, "Failed to load polls");
  return (data || []).map((p) => ({
    id: p.id,
    question: p.question,
    options: (p.poll_options || []).sort((a, b) => a.position - b.position),
  }));
}

export async function createPoll({ question, options }) {
  const cleaned = (options || []).map((o) => o.trim()).filter(Boolean);
  const { data: poll, error } = await supabase.from("polls").insert({ question: question.trim() }).select().single();
  throwIfError(error, "Failed to create poll");
  if (cleaned.length > 0) {
    const { error: optError } = await supabase
      .from("poll_options")
      .insert(cleaned.map((label, i) => ({ poll_id: poll.id, label, position: i })));
    throwIfError(optError, "Failed to create poll options");
  }
  return poll;
}

// Reconciles options by position so existing option ids (and therefore
// their votes) survive an edit — same rule the original localStorage
// version used. Options beyond the new length are deleted (and their votes
// cascade-deleted with them); new labels beyond the old length are inserted.
export async function updatePoll(pollId, { question, options }) {
  const cleaned = (options || []).map((o) => o.trim()).filter(Boolean);
  const { error: qError } = await supabase.from("polls").update({ question: question.trim() }).eq("id", pollId);
  throwIfError(qError, "Failed to update poll");

  const { data: current, error: curError } = await supabase
    .from("poll_options")
    .select("id, position")
    .eq("poll_id", pollId)
    .order("position", { ascending: true });
  throwIfError(curError, "Failed to load existing options");

  const updates = [];
  const inserts = [];
  cleaned.forEach((label, i) => {
    if (current[i]) updates.push(supabase.from("poll_options").update({ label }).eq("id", current[i].id));
    else inserts.push({ poll_id: pollId, label, position: i });
  });
  const toRemove = current.slice(cleaned.length).map((o) => o.id);

  await Promise.all(updates);
  if (inserts.length > 0) {
    const { error } = await supabase.from("poll_options").insert(inserts);
    throwIfError(error, "Failed to add new poll options");
  }
  if (toRemove.length > 0) {
    const { error } = await supabase.from("poll_options").delete().in("id", toRemove);
    throwIfError(error, "Failed to remove old poll options");
  }
}

export async function deletePoll(pollId) {
  const { error } = await supabase.from("polls").delete().eq("id", pollId);
  throwIfError(error, "Failed to delete poll");
}

export async function castVote(pollId, optionId) {
  const { error } = await supabase.rpc("cast_vote", { p_poll_id: pollId, p_option_id: optionId });
  throwIfError(error, "Failed to cast vote");
}

// Returns { [pollId]: optionId } for every poll the signed-in user has
// voted in. RLS on poll_votes already restricts results to the caller's own
// rows, so no explicit voter_id filter is needed here.
export async function listMyVotes() {
  const { data, error } = await supabase.from("poll_votes").select("poll_id, option_id");
  throwIfError(error, "Failed to load your votes");
  const map = {};
  (data || []).forEach((v) => { map[v.poll_id] = v.option_id; });
  return map;
}

// Returns { [optionId]: count } across all polls (small app, cheap to fetch
// in one shot and filter client-side per poll).
export async function listVoteCounts() {
  const { data, error } = await supabase.from("poll_vote_counts").select("*");
  throwIfError(error, "Failed to load poll results");
  const map = {};
  (data || []).forEach((row) => { map[row.option_id] = row.votes; });
  return map;
}

// Admin-only "who voted" detail for one poll.
export async function listVoters(pollId) {
  const { data, error } = await supabase
    .from("poll_votes")
    .select("voted_at, option_id, profiles(username), poll_options(label)")
    .eq("poll_id", pollId)
    .order("voted_at", { ascending: false });
  throwIfError(error, "Failed to load voters");
  return (data || []).map((v) => ({
    voter: v.profiles?.username || "Unknown",
    optionLabel: v.poll_options?.label || "—",
    at: v.voted_at,
  }));
}
