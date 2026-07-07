# QuizPoll — Online Exam Builder

A small exam/quiz/poll app: admins build exams (manually, or by importing
JSON/CSV/DOCX/PDF), students sign in and take them, and an admin dashboard
shows per-question difficulty stats. There's also a lightweight live-poll
feature.

## Tech stack

- React 19 + TanStack Router / TanStack Start (file-based routes, SSR)
- Vite 8, Tailwind CSS 4, shadcn/ui (Radix primitives)
- **Supabase** (Postgres + Auth + Row Level Security) — the real backend.
  Exams, questions, polls, votes, accounts, and exam results all live here.
  Schema + RLS policies + server-side grading: `supabase/migrations/0001_init.sql`.
- `mammoth` (DOCX text extraction) + `pdfjs-dist` (PDF text extraction)
- Anthropic API (Claude) to turn extracted document text into structured
  question JSON

## Getting started

1. Create a free project at [supabase.com](https://supabase.com).
2. In the Supabase SQL editor, run `supabase/migrations/0001_init.sql` once.
3. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` (Settings → API in your Supabase project).
4. Promote your first admin: sign up a normal account through the app's
   `/login` page, then in the Supabase SQL editor run:
   ```sql
   update public.profiles set role = 'admin' where username = 'your_username';
   ```
   (This only works run directly in the SQL editor — the app itself
   deliberately blocks anyone from self-promoting to admin.)

```bash
npm install   # or: bun install
npm run dev   # or: bun run dev
```

Open the printed local URL and sign in with the account you just promoted.

### Environment variables

Copy `.env.example` to `.env` and fill in `ANTHROPIC_API_KEY` if you want
the **"upload a Word/PDF file and let AI extract the questions"** feature
to work. Everything else in the app (manual question entry, JSON import,
CSV import, polls, exams, results) works with zero configuration.

```bash
cp .env.example .env
# then edit .env and paste a real key from https://console.anthropic.com
```

If you're running inside the Lovable editor/preview, set this as a
**Secret** in Project Settings instead of a `.env` file. If you deploy
elsewhere (Cloudflare, Vercel, your own Node host, etc.), set it as a real
environment variable/secret on that platform.

Without this key, DOCX/PDF import will fail with a clear "ANTHROPIC_API_KEY
is missing" error — it's not silently broken, it just can't extract
questions from a document without an AI call. JSON/CSV import is the
keyless alternative.

### Build & deploy

```bash
npm run build
npm run preview   # sanity-check the production build locally
```

The Vite config targets Cloudflare Workers by default via `nitro`
(see `vite.config.ts`), but the app is plain TanStack Start and can be
deployed to any Node-compatible host.

## Importing questions

From the admin dashboard → an exam → **Import Questions from File**:

| Format | How it's parsed | Needs `ANTHROPIC_API_KEY`? |
|---|---|---|
| `.json` | Direct array of `{ type, text, options?, answer?/answers? }` | No |
| `.csv`  | Header row: `type,text,option_a,...,answer` | No |
| `.docx` | Text extracted locally, then sent to Claude to structure into questions | Yes |
| `.pdf`  | Same as DOCX | Yes |

Click "File format guide" in that panel for exact JSON/CSV examples.

## Known limitations

This started as a Lovable-generated localStorage prototype and has since
been migrated onto a real Supabase backend (Postgres + Auth + Row Level
Security + server-side grading — see `supabase/migrations/0001_init.sql`).
A few things still worth knowing:

- **Username/password convenience layer over email auth.** Supabase Auth is
  email-based; sign-up/sign-in derives a synthetic email from the username
  (`jane@quizpoll.local`) so the UI can stay username-only. Usernames that
  differ only by punctuation (`jane_doe` vs `jane-doe`) would collide under
  this scheme — fine for a single class/cohort, worth hardening (e.g. real
  email collection) before opening this up to the general public.
- **No server-side authorization on the AI-import endpoint.** The
  `parseFileQuestions` server function (DOCX/PDF → AI question extraction)
  doesn't check who's calling it — anyone with network access to the
  deployed app could trigger it and burn your Anthropic API quota. Everything
  it returns still has to pass through the RLS-protected `importQuestionsToExam`
  insert to land in the database, so it can't write data, but it's worth
  adding an auth check if you're deploying this publicly.
- **First admin is bootstrapped manually** via the SQL editor (see step 4
  above) — there's no in-app "make me an admin" flow, by design.

## Project structure

```
src/
  routes/        # file-based routes: /, /login, /exams, /exams/:id, /admin, /polls
  lib/store.js    # all localStorage read/write + auth logic
  lib/data.js     # seed exams/polls shown on first load
  lib/api/        # server functions (parse-file.functions.ts = AI import)
  components/ui/  # shadcn/ui primitives
```
