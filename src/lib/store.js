// Client-side persistence for exams, questions, polls and results (localStorage).
// No TypeScript. Seeded from data.js on first load.
import { useEffect, useState } from "react";
import { seedExams, seedPolls } from "./data.js";

const EXAMS_KEY = "quizpoll_exams_v1";
const POLLS_KEY = "quizpoll_polls_v1";
const RESULTS_KEY = "quizpoll_results_v1";
const USERS_KEY = "quizpoll_users_v1";
const ADMIN_CREDS_KEY = "quizpoll_admin_creds_v1";
const STUDENT_KEY = "quizpoll_student";
const ADMIN_KEY = "quizpoll_admin";

function read(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota errors */
  }
}

// ---------- Exams & questions ----------
export function getExams() {
  const stored = read(EXAMS_KEY, null);
  if (stored && Array.isArray(stored)) return stored;
  write(EXAMS_KEY, seedExams);
  return seedExams;
}

export function saveExams(exams) {
  write(EXAMS_KEY, exams);
}

export function getExam(id) {
  return getExams().find((e) => e.id === id);
}

function slugify(text) {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "subject"
  );
}

export function addExam({ title, description, minutes }) {
  const exams = getExams();
  let id = slugify(title);
  while (exams.some((e) => e.id === id)) id = id + "-" + Math.floor(Math.random() * 1000);
  const exam = {
    id,
    title: title.trim(),
    description: (description || "").trim(),
    minutes: Number(minutes) > 0 ? Number(minutes) : 5,
    questions: [],
  };
  exams.push(exam);
  saveExams(exams);
  return exams;
}

export function removeExam(examId) {
  const exams = getExams().filter((e) => e.id !== examId);
  saveExams(exams);
  return exams;
}

export function addQuestion(examId, question) {
  const exams = getExams();
  const exam = exams.find((e) => e.id === examId);
  if (!exam) return exams;
  exam.questions = [
    ...exam.questions,
    { id: "q" + Date.now(), ...question },
  ];
  saveExams(exams);
  return exams;
}

export function updateQuestion(examId, questionId, question) {
  const exams = getExams();
  const exam = exams.find((e) => e.id === examId);
  if (!exam) return exams;
  exam.questions = exam.questions.map((q) =>
    q.id === questionId ? { ...q, ...question, id: q.id } : q
  );
  saveExams(exams);
  return exams;
}

export function removeQuestion(examId, questionId) {
  const exams = getExams();
  const exam = exams.find((e) => e.id === examId);
  if (exam) exam.questions = exam.questions.filter((q) => q.id !== questionId);
  saveExams(exams);
  return exams;
}

// ---------- Bulk import ----------
// Supported question shapes:
//   multiple_choice: { type:"multiple_choice", text, options:string[], answer:number }
//   short_answer:    { type:"short_answer",    text, answer:string }
//   checkbox:        { type:"checkbox",        text, options:string[], answers:number[] }
// Omitting `type` defaults to multiple_choice for backwards compat.
// Returns { exams, imported, errors }
export function importQuestionsToExam(examId, questions) {
  const exams = getExams();
  const exam = exams.find((e) => e.id === examId);
  if (!exam) return { exams, imported: 0, errors: ["Exam not found."] };
  let imported = 0;
  const errors = [];
  (questions || []).forEach((q, i) => {
    const label = `Row ${i + 1}`;
    if (!q.text || typeof q.text !== "string" || !q.text.trim()) {
      errors.push(`${label}: missing question text.`);
      return;
    }
    const type = q.type || "multiple_choice";

    if (type === "short_answer") {
      exam.questions.push({
        id: "q" + Date.now() + "_" + i,
        type: "short_answer",
        text: q.text.trim(),
        answer: String(q.answer || "").trim(),
      });
      imported++;
      return;
    }

    if (type === "checkbox") {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        errors.push(`${label}: checkbox needs at least 2 options.`);
        return;
      }
      const opts = q.options.map((o) => String(o).trim()).filter(Boolean);
      const answers = Array.isArray(q.answers)
        ? q.answers.map(Number).filter((n) => !isNaN(n) && n >= 0 && n < opts.length)
        : [];
      exam.questions.push({
        id: "q" + Date.now() + "_" + i,
        type: "checkbox",
        text: q.text.trim(),
        options: opts,
        answers,
      });
      imported++;
      return;
    }

    // Default: multiple_choice
    if (!Array.isArray(q.options) || q.options.length < 2) {
      errors.push(`${label}: need at least 2 options.`);
      return;
    }
    const opts = q.options.map((o) => String(o).trim()).filter(Boolean);
    if (opts.length < 2) {
      errors.push(`${label}: need at least 2 non-empty options.`);
      return;
    }
    const ans = Number(q.answer);
    if (isNaN(ans) || ans < 0 || ans >= opts.length) {
      errors.push(`${label}: answer index ${q.answer} out of range (0–${opts.length - 1}).`);
      return;
    }
    exam.questions.push({
      id: "q" + Date.now() + "_" + i,
      type: "multiple_choice",
      text: q.text.trim(),
      options: opts,
      answer: ans,
    });
    imported++;
  });
  saveExams(exams);
  return { exams, imported, errors };
}

// ---------- Polls ----------
export function getPolls() {
  const stored = read(POLLS_KEY, null);
  if (stored && Array.isArray(stored)) return stored;
  const seeded = seedPolls.map((p) => ({
    ...p,
    options: p.options.map((o) => ({ ...o })),
    voters: [],
  }));
  write(POLLS_KEY, seeded);
  return seeded;
}

export function savePolls(polls) {
  write(POLLS_KEY, polls);
}

export function addPoll({ question, options }) {
  const polls = getPolls();
  const cleaned = (options || []).map((o) => o.trim()).filter(Boolean);
  const poll = {
    id: "poll" + Date.now(),
    question: question.trim(),
    options: cleaned.map((label, i) => ({ id: "o" + i + "_" + Date.now(), label, votes: 0 })),
    voters: [],
  };
  polls.push(poll);
  savePolls(polls);
  return polls;
}

export function updatePoll(pollId, { question, options }) {
  const polls = getPolls();
  const poll = polls.find((p) => p.id === pollId);
  if (!poll) return polls;
  poll.question = question.trim();
  const cleaned = (options || []).map((o) => o.trim()).filter(Boolean);
  // Preserve votes for options that still exist (by index position).
  poll.options = cleaned.map((label, i) => {
    const prev = poll.options[i];
    return {
      id: prev ? prev.id : "o" + i + "_" + Date.now(),
      label,
      votes: prev ? prev.votes : 0,
    };
  });
  savePolls(polls);
  return polls;
}

export function removePoll(pollId) {
  const polls = getPolls().filter((p) => p.id !== pollId);
  savePolls(polls);
  return polls;
}

export function votePoll(pollId, optionId, voter) {
  const polls = getPolls();
  const poll = polls.find((p) => p.id === pollId);
  if (!poll) return polls;
  const opt = poll.options.find((o) => o.id === optionId);
  if (!opt) return polls;
  poll.voters = poll.voters || [];
  const me = voter || "Anonymous";
  const existing = poll.voters.find((v) => v.voter === me);
  if (existing) {
    if (existing.optionId === optionId) return polls;
    const oldOpt = poll.options.find((o) => o.id === existing.optionId);
    if (oldOpt && oldOpt.votes > 0) oldOpt.votes -= 1;
    poll.voters = poll.voters.filter((v) => v.voter !== me);
  }
  opt.votes += 1;
  poll.voters.push({ voter: me, optionId, at: new Date().toISOString() });
  savePolls(polls);
  return polls;
}

// ---------- Results ----------
export function getResults() {
  return read(RESULTS_KEY, []);
}

export function addResult(result) {
  const results = getResults();
  results.push(result);
  write(RESULTS_KEY, results);
  return results;
}

export function clearResults() {
  write(RESULTS_KEY, []);
}

// ---------- Derived stats ----------
// Returns difficulty info per question across all recorded results.
export function getQuestionStats() {
  const exams = getExams();
  const results = getResults();
  return exams.map((exam) => {
    const questions = exam.questions.map((q) => {
      let attempts = 0;
      let correct = 0;
      for (const r of results) {
        if (r.examId !== exam.id) continue;
        const ans = r.perQuestion ? r.perQuestion[q.id] : undefined;
        if (ans === undefined) continue;
        attempts += 1;
        if (ans) correct += 1;
      }
      const correctRate = attempts ? Math.round((correct / attempts) * 100) : null;
      let difficulty = "No data";
      if (correctRate !== null) {
        if (correctRate >= 70) difficulty = "Easy";
        else if (correctRate >= 40) difficulty = "Medium";
        else difficulty = "Hard";
      }
      return { id: q.id, text: q.text, attempts, correctRate, difficulty };
    });
    return { examId: exam.id, title: exam.title, questions };
  });
}

// ---------- Auth / sessions (client-side) ----------
function getUsers() {
  return read(USERS_KEY, {});
}

function saveUsers(users) {
  write(USERS_KEY, users);
}

export function getAdminCreds() {
  return read(ADMIN_CREDS_KEY, { username: "admin", password: "admin123" });
}

export function setAdminCreds(username, password) {
  const next = { username: username.trim(), password };
  write(ADMIN_CREDS_KEY, next);
  return next;
}

export function getStudent() {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(STUDENT_KEY) || null;
  } catch {
    return null;
  }
}

// Register a new student with username + password.
// Returns { ok, error }.
export function registerStudent(username, password, email) {
  const u = username.trim();
  if (!u || !password) return { ok: false, error: "Enter a username and password." };
  const users = getUsers();
  if (users[u]) return { ok: false, error: "That username is already taken." };
  users[u] = { password, email: (email || "").trim() };
  saveUsers(users);
  if (typeof window !== "undefined") window.sessionStorage.setItem(STUDENT_KEY, u);
  return { ok: true };
}

// Sign in an existing student. Returns { ok, error }.
export function loginStudent(username, password) {
  const u = username.trim();
  const users = getUsers();
  if (!users[u]) return { ok: false, error: "No account found with that username." };
  if (users[u].password !== password) return { ok: false, error: "Incorrect password." };
  if (typeof window !== "undefined") window.sessionStorage.setItem(STUDENT_KEY, u);
  return { ok: true };
}

export function isAdmin() {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(ADMIN_KEY) === "1";
}

export function loginAdmin(username, password) {
  const creds = getAdminCreds();
  if (username.trim() !== creds.username || password !== creds.password) return false;
  if (typeof window !== "undefined") window.sessionStorage.setItem(ADMIN_KEY, "1");
  return true;
}

export function logout() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STUDENT_KEY);
  window.sessionStorage.removeItem(ADMIN_KEY);
}

// React hooks -------------------------------------------------------
export function useExams() {
  const [exams, setExams] = useState(seedExams);
  useEffect(() => {
    setExams(getExams());
  }, []);
  return [exams, setExams];
}

// ---------- Exam attempt guard ----------
export function hasStudentTakenExam(student, examId) {
  if (!student) return false;
  return getResults().some((r) => r.student === student && r.examId === examId);
}
