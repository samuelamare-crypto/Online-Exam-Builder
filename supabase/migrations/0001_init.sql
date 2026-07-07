-- ============================================================================
-- QuizPoll — Supabase schema
--
-- Run this in the Supabase SQL editor (or via `supabase db push` /
-- migrations) on a fresh project. It assumes the standard Supabase
-- `auth.users` table and `auth.uid()` function already exist (they do, on
-- every Supabase project).
--
-- IMPORTANT: run this as the `postgres` role (the default for the SQL
-- editor and CLI migrations). The `questions_public` and `poll_vote_counts`
-- views below intentionally rely on being owned by a role that bypasses
-- RLS, so they can expose a safe, limited set of columns/aggregates to
-- every signed-in user while the underlying tables stay locked down. If
-- you ever recreate these views under a different, non-bypassrls owner,
-- re-test that students can still read them.
-- ============================================================================

-- ── profiles ────────────────────────────────────────────────────────────────
-- One row per auth user. `role` drives every admin-only permission below.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- security definer + explicit search_path: lets policies elsewhere check
-- "is this caller an admin?" without recursing back into profiles' own RLS,
-- and without being hijacked by a malicious search_path.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Defense in depth: even though the policy above lets a user UPDATE their
-- own row, a user must never be able to grant themselves admin. Only an
-- existing admin can change anyone's role.
-- Only guards changes made through the live API (the `authenticated`
-- Postgres role PostgREST/Supabase uses for logged-in users). Changes made
-- by the project owner directly via the SQL editor or migrations (running
-- as `postgres`) are intentionally NOT blocked — that's how you promote
-- the very first admin, since at that point no admin exists yet to satisfy
-- is_admin().
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and current_user = 'authenticated'
     and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

create trigger trg_prevent_role_self_escalation
before update on public.profiles
for each row execute function public.prevent_role_self_escalation();

-- Auto-create a profile row whenever someone signs up via Supabase Auth.
-- Username comes from the `username` field passed in signUp({ options: {
-- data: { username } } }); falls back to the email's local part.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1));
begin
  insert into public.profiles (id, username, role) values (new.id, v_username, 'student');
  return new;
exception when unique_violation then
  insert into public.profiles (id, username, role)
  values (new.id, v_username || '_' || substr(new.id::text, 1, 6), 'student');
  return new;
end;
$$;

create trigger trg_handle_new_user
after insert on auth.users
for each row execute function public.handle_new_user();

-- ── exams ───────────────────────────────────────────────────────────────────
create table public.exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  minutes integer not null default 5 check (minutes > 0),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.exams enable row level security;

create policy "exams_select_all" on public.exams
  for select to authenticated using (true);
create policy "exams_admin_insert" on public.exams
  for insert to authenticated with check (public.is_admin());
create policy "exams_admin_update" on public.exams
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "exams_admin_delete" on public.exams
  for delete to authenticated using (public.is_admin());

-- ── questions ───────────────────────────────────────────────────────────────
-- Answer columns (answer_index / answer_indices / answer_text) must NEVER
-- be selectable by students directly — that's the whole point of moving
-- this app off localStorage. Only admins get a SELECT policy on this table
-- at all; everyone else reads through `questions_public` below, whose
-- column list simply never includes the answers.
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  type text not null check (type in ('multiple_choice', 'short_answer', 'checkbox')),
  text text not null,
  options jsonb,                -- string[] for multiple_choice/checkbox
  answer_index integer,         -- multiple_choice: correct option index
  answer_indices integer[],     -- checkbox: correct option indices
  answer_text text,             -- short_answer: expected text, null = manually graded
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.questions enable row level security;

create policy "questions_admin_select" on public.questions
  for select to authenticated using (public.is_admin());
create policy "questions_admin_insert" on public.questions
  for insert to authenticated with check (public.is_admin());
create policy "questions_admin_update" on public.questions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "questions_admin_delete" on public.questions
  for delete to authenticated using (public.is_admin());

create view public.questions_public as
  select id, exam_id, type, text, options, position
  from public.questions;

grant select on public.questions_public to authenticated;

-- ── exam_attempts (results) ──────────────────────────────────────────────────
-- One attempt per (exam, student) — matches the original app's "each exam
-- can only be taken once" rule. Rows are only ever written by
-- submit_exam_attempt() below, never inserted directly by students.
create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  score integer not null,
  total integer not null,
  percent integer not null,
  answers jsonb not null,
  per_question jsonb not null,
  review jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default now(),
  unique (exam_id, student_id)
);

alter table public.exam_attempts enable row level security;

create policy "exam_attempts_select_own_or_admin" on public.exam_attempts
  for select to authenticated using (student_id = auth.uid() or public.is_admin());
create policy "exam_attempts_admin_delete" on public.exam_attempts
  for delete to authenticated using (public.is_admin());
-- No insert/update policy for authenticated at all: rows are written only
-- by submit_exam_attempt(), a security definer function that bypasses RLS.

-- ── Grading function ─────────────────────────────────────────────────────────
-- The ONE place that ever reads the answer columns on behalf of a student.
-- Takes the student's in-progress answers as jsonb (question_id -> answer),
-- grades them server-side, stores the attempt, and returns just the score
-- plus a review payload (revealed only after submission, same as the
-- original app's post-submit review screen).
create or replace function public.submit_exam_attempt(p_exam_id uuid, p_answers jsonb)
returns table (score integer, total integer, percent integer, per_question jsonb, review jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := auth.uid();
  v_q record;
  v_user_answer jsonb;
  v_is_correct boolean;
  v_score integer := 0;
  v_total integer := 0;
  v_per_question jsonb := '{}'::jsonb;
  v_review jsonb := '[]'::jsonb;
  v_given_set integer[];
begin
  if v_student_id is null then
    raise exception 'Not authenticated';
  end if;

  if exists (
    select 1 from public.exam_attempts
    where exam_id = p_exam_id and student_id = v_student_id
  ) then
    raise exception 'You have already submitted this exam';
  end if;

  for v_q in select * from public.questions where exam_id = p_exam_id order by position loop
    v_user_answer := p_answers -> v_q.id::text;
    v_is_correct := null;

    if v_q.type = 'short_answer' then
      if v_q.answer_text is not null and length(trim(v_q.answer_text)) > 0 then
        v_is_correct := lower(trim(coalesce(v_user_answer #>> '{}', ''))) = lower(trim(v_q.answer_text));
      end if; -- else stays null: manually graded, not counted

    elsif v_q.type = 'checkbox' then
      select coalesce(array_agg(x::int order by x::int), array[]::int[])
        into v_given_set
        from jsonb_array_elements_text(coalesce(v_user_answer, '[]'::jsonb)) x;
      v_is_correct := v_given_set = (
        select coalesce(array_agg(y order by y), array[]::int[]) from unnest(v_q.answer_indices) y
      );

    else -- multiple_choice
      v_is_correct := (v_user_answer is not null) and ((v_user_answer #>> '{}')::int = v_q.answer_index);
    end if;

    if v_is_correct is not null then
      v_total := v_total + 1;
      if v_is_correct then v_score := v_score + 1; end if;
    end if;

    v_per_question := v_per_question || jsonb_build_object(v_q.id::text, v_is_correct);
    v_review := v_review || jsonb_build_array(jsonb_build_object(
      'id', v_q.id,
      'correct_answer_index', v_q.answer_index,
      'correct_answer_indices', v_q.answer_indices,
      'correct_answer_text', v_q.answer_text
    ));
  end loop;

  insert into public.exam_attempts (exam_id, student_id, score, total, percent, answers, per_question, review)
  values (
    p_exam_id, v_student_id, v_score, v_total,
    case when v_total > 0 then round((v_score::numeric / v_total) * 100) else 0 end,
    p_answers, v_per_question, v_review
  )
  on conflict (exam_id, student_id) do nothing;

  if not found then
    -- Lost a race with a concurrent submit from the same student (e.g. a
    -- double-click or two tabs); fall back to whatever the winner stored
    -- rather than erroring or double-counting.
    select score, total, per_question, review into v_score, v_total, v_per_question, v_review
      from public.exam_attempts where exam_id = p_exam_id and student_id = v_student_id;
  end if;

  return query select
    v_score, v_total,
    case when v_total > 0 then round((v_score::numeric / v_total) * 100)::int else 0 end,
    v_per_question, v_review;
end;
$$;

grant execute on function public.submit_exam_attempt(uuid, jsonb) to authenticated;

-- ── polls ───────────────────────────────────────────────────────────────────
create table public.polls (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  label text not null,
  position integer not null default 0
);

create table public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  option_id uuid not null references public.poll_options (id) on delete cascade,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  voted_at timestamptz not null default now(),
  unique (poll_id, voter_id)
);

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

create policy "polls_select_all" on public.polls for select to authenticated using (true);
create policy "polls_admin_insert" on public.polls for insert to authenticated with check (public.is_admin());
create policy "polls_admin_update" on public.polls for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "polls_admin_delete" on public.polls for delete to authenticated using (public.is_admin());

create policy "poll_options_select_all" on public.poll_options for select to authenticated using (true);
create policy "poll_options_admin_insert" on public.poll_options for insert to authenticated with check (public.is_admin());
create policy "poll_options_admin_update" on public.poll_options for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "poll_options_admin_delete" on public.poll_options for delete to authenticated using (public.is_admin());

-- Individual ballots are private: a student can see their own vote; only
-- admins can see who-voted-for-what. Everyone else gets aggregate counts
-- only, via the view below. There is deliberately NO insert/update policy
-- here — a raw client insert could set voter_id correctly but still pair a
-- mismatched poll_id/option_id (an option from a different poll), corrupting
-- that poll's aggregate counts. cast_vote() below validates the
-- option-belongs-to-poll relationship server-side, so it's the only path
-- allowed to write a vote.
create policy "poll_votes_select_own_or_admin" on public.poll_votes
  for select to authenticated using (voter_id = auth.uid() or public.is_admin());

create view public.poll_vote_counts as
  select poll_id, option_id, count(*) as votes
  from public.poll_votes
  group by poll_id, option_id;

grant select on public.poll_vote_counts to authenticated;

-- "Change my vote" = upsert on the (poll_id, voter_id) unique key.
create or replace function public.cast_vote(p_poll_id uuid, p_option_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (select 1 from public.poll_options where id = p_option_id and poll_id = p_poll_id) then
    raise exception 'Option does not belong to this poll';
  end if;
  insert into public.poll_votes (poll_id, option_id, voter_id)
  values (p_poll_id, p_option_id, auth.uid())
  on conflict (poll_id, voter_id) do update set option_id = excluded.option_id, voted_at = now();
end;
$$;

grant execute on function public.cast_vote(uuid, uuid) to authenticated;
