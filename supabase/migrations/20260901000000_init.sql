-- ============================================================
-- DualCrit — initial schema
--
-- Identity is the student ID. There is no password: knowing an ID is
-- enough to sign in as that student, so this identifies rather than
-- authenticates. Do not store anything here that a classmate should not
-- be able to open.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- shared trigger ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- identity ----------
create table public.students (
  id           uuid primary key default uuid_generate_v4(),
  student_id   text not null unique,
  full_name    text not null check (length(btrim(full_name)) between 1 and 80),
  role         text not null default 'student'
                 check (role in ('student','instructor')),
  consented_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger students_updated before update on public.students
  for each row execute function public.set_updated_at();

-- ---------- activities (a team's run through the workflow) ----------
create table public.activities (
  id                        uuid primary key default uuid_generate_v4(),
  code                      text not null unique,
  name                      text not null default 'Untitled Activity',
  type                      text not null default 'interview'
                              check (type in ('interview','pov_hmw')),
  status                    text not null default 'active'
                              check (status in ('active','completed','archived')),
  max_participants          integer not null default 4
                              check (max_participants between 1 and 12),
  host_id                   uuid not null references public.students(id) on delete cascade,
  selected_scenario_tag     text,
  selected_question_content text,
  selected_pov_content      text,
  selected_hmw_contents     text[],
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index activities_status_idx on public.activities (status);
create trigger activities_updated before update on public.activities
  for each row execute function public.set_updated_at();

-- Join codes are generated in the database, never by the app.
-- Ambiguous characters (I, O, 0, 1) are excluded.
create or replace function public.generate_activity_code()
returns text language plpgsql as $$
declare
  alphabet  text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate ||
        substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.activities where code = candidate);
  end loop;
  return candidate;
end $$;

create or replace function public.set_activity_code()
returns trigger language plpgsql as $$
begin
  if new.code is null or new.code = '' then
    new.code := public.generate_activity_code();
  end if;
  return new;
end $$;

create trigger activities_set_code before insert on public.activities
  for each row execute function public.set_activity_code();

-- ---------- participants (carries each student's step) ----------
create table public.activity_members (
  activity_id     uuid not null references public.activities(id) on delete cascade,
  student_id      uuid not null references public.students(id) on delete cascade,
  is_host         boolean not null default false,
  is_active       boolean not null default true,
  current_step    text,
  step_updated_at timestamptz,
  joined_at       timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  primary key (activity_id, student_id)
);
create index activity_members_student_idx on public.activity_members (student_id);
-- exactly one host per activity
create unique index activity_members_one_host_idx
  on public.activity_members (activity_id) where is_host;

-- ---------- contributions ----------
-- The unique constraint is the point: one interview question per student,
-- three HMW slots, one POV. Re-submitting updates rather than duplicating.
create table public.contributions (
  id          uuid primary key default uuid_generate_v4(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  type        text not null
                check (type in ('interview_question','pov_statement','hmw_question')),
  content     jsonb not null,
  order_index integer not null default 1 check (order_index between 1 and 10),
  is_selected boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (activity_id, student_id, type, order_index)
);
create index contributions_activity_type_idx on public.contributions (activity_id, type);
create trigger contributions_updated before update on public.contributions
  for each row execute function public.set_updated_at();

-- ---------- voting ----------
create table public.voting_rounds (
  id             uuid primary key default uuid_generate_v4(),
  activity_id    uuid not null references public.activities(id) on delete cascade,
  type           text not null check (type in
                   ('scenario_selection','interview_question','pov_statement','hmw_question')),
  status         text not null default 'active'
                   check (status in ('active','completed','cancelled')),
  max_selections integer not null default 1 check (max_selections >= 1),
  started_by     uuid references public.students(id) on delete set null,
  created_at     timestamptz not null default now(),
  completed_at   timestamptz
);

-- At most ONE active round per (activity, type). This is what makes
-- "start voting" idempotent: a second call conflicts instead of
-- resetting the tally.
create unique index voting_rounds_one_active_idx
  on public.voting_rounds (activity_id, type) where status = 'active';

-- One row per vote. No read-modify-write, so no lost updates, no mutex.
create table public.votes (
  round_id   uuid not null references public.voting_rounds(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  option_id  text not null,
  created_at timestamptz not null default now(),
  primary key (round_id, student_id, option_id)
);
create index votes_round_idx on public.votes (round_id);

create view public.vote_tallies
  with (security_invoker = on) as
select r.id as round_id,
       r.activity_id,
       r.type,
       v.option_id,
       count(*)::int as vote_count
from public.voting_rounds r
join public.votes v on v.round_id = r.id
group by r.id, r.activity_id, r.type, v.option_id;

-- ---------- interview ----------
-- Attempts are kept, not overwritten; "latest" is deterministic.
create table public.interview_transcripts (
  id           uuid primary key default uuid_generate_v4(),
  activity_id  uuid not null references public.activities(id) on delete cascade,
  student_id   uuid not null references public.students(id) on delete cascade,
  attempt      integer not null default 1 check (attempt >= 1),
  messages     jsonb not null,
  scenario_tag text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (activity_id, student_id, attempt)
);
create index transcripts_latest_idx
  on public.interview_transcripts (activity_id, student_id, attempt desc);
create trigger transcripts_updated before update on public.interview_transcripts
  for each row execute function public.set_updated_at();

create table public.interview_completions (
  activity_id  uuid not null references public.activities(id) on delete cascade,
  student_id   uuid not null references public.students(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (activity_id, student_id)
);

-- ---------- AI evaluations ----------
-- `scope` makes team-vs-user explicit. A team evaluation has no student_id
-- and there can only be one of each type per activity, so the team shares a
-- single LLM call instead of one per student.
create table public.ai_evaluations (
  id               uuid primary key default uuid_generate_v4(),
  activity_id      uuid not null references public.activities(id) on delete cascade,
  student_id       uuid references public.students(id) on delete cascade,
  scope            text not null check (scope in ('team','user')),
  evaluation_type  text not null check (evaluation_type in
                     ('pre_question_eval','post_interview_eval','pov_feedback','hmw_feedback')),
  model            text,
  input_data       jsonb not null,
  ai_response      jsonb not null,
  processed_scores jsonb,
  feedback_summary text,
  created_at       timestamptz not null default now(),
  constraint ai_evaluations_scope_student_ck check (
    (scope = 'team' and student_id is null) or
    (scope = 'user' and student_id is not null)
  )
);
create unique index ai_evaluations_one_team_idx
  on public.ai_evaluations (activity_id, evaluation_type) where scope = 'team';
create index ai_evaluations_lookup_idx
  on public.ai_evaluations (activity_id, evaluation_type, student_id);

-- ---------- summaries ----------
-- Primary key gives the upsert its conflict target, in the schema this time.
create table public.interview_summaries (
  activity_id    uuid not null references public.activities(id) on delete cascade,
  student_id     uuid not null references public.students(id) on delete cascade,
  summary_text   text not null,
  summary_format text not null default 'markdown'
                   check (summary_format in ('text','markdown','html')),
  question_count integer,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (activity_id, student_id)
);
create trigger summaries_updated before update on public.interview_summaries
  for each row execute function public.set_updated_at();

-- ---------- POV / HMW ----------
create table public.pov_hmw_data (
  activity_id uuid primary key references public.activities(id) on delete cascade,
  needs       text[] not null default '{}',
  insights    text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger pov_hmw_updated before update on public.pov_hmw_data
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row Level Security
--
-- RLS is enabled with NO policies, deliberately. The backend connects with
-- the service_role key, which bypasses RLS. Everyone else — including
-- anyone holding a leaked anon key — can read and write nothing.
--
-- Only add policies if a client ever talks to Supabase directly.
-- ============================================================

alter table public.students              enable row level security;
alter table public.activities            enable row level security;
alter table public.activity_members      enable row level security;
alter table public.contributions         enable row level security;
alter table public.voting_rounds         enable row level security;
alter table public.votes                 enable row level security;
alter table public.interview_transcripts enable row level security;
alter table public.interview_completions enable row level security;
alter table public.ai_evaluations        enable row level security;
alter table public.interview_summaries   enable row level security;
alter table public.pov_hmw_data          enable row level security;
