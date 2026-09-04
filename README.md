# DualCrit

Collaborative design-thinking activities for HCI teaching. Students sign in with
their student ID, join a team activity with a code, and work through the
workflow together.

Rebuild of GenAI4HCI. The reasoning behind the architecture — and the audit it
came from — is in the rebuild brief.

## The workflow

1. Each student writes their own interview question.
2. The team **votes**; one question wins.
3. The AI evaluates **that single selected question** — a team-level result.
4. Each student runs **their own** AI interview using it.
5. Each student is evaluated on their own transcript.

Steps 1–3 are team-scoped, 4–5 are per-student. Most of the data-scoping bugs
in the previous system came from that distinction not being explicit, so it is
recorded in the schema: `ai_evaluations.scope` is either `team` or `user`.

## Stack

| Part | Choice |
|---|---|
| Frontend | Vite + React + TypeScript + Tailwind v4 |
| Backend | NestJS + TypeScript |
| Database | Supabase (Postgres) |

## Running it

**1. Database.** Create a Supabase project, open the SQL Editor, and run
`supabase/migrations/20260901000000_init.sql`.

**2. Backend.**

```bash
cd backend
cp .env.example .env     # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET
npm install
npm run start:dev
```

**3. Frontend.**

```bash
cd frontend
cp .env.example .env     # VITE_API_URL=http://localhost:3000
npm install
npm run dev
```

Open http://localhost:5173 and sign in with any student ID.

## Ground rules

These exist because the previous system broke each of them.

**Secrets.** The service-role key and the OpenAI key belong in the backend
environment only. Every `VITE_` variable is compiled into the browser bundle
and readable by anyone who opens the site — never put a key behind that prefix.

**Identity is the student ID, and there is no password.** Knowing an ID is
enough to sign in as that student, so this identifies rather than
authenticates. Do not store anything a classmate should not be able to open.

**The database is the source of truth for shared state.** Nothing important
lives only in server memory: the backend restarts on every deploy. Room state
in a `Map` is what wiped live sessions mid-class in the previous system.

**Commands are idempotent.** Anything a component can fire on mount must be
safe to fire twice — assume it will be. Starting a vote twice must not reset
the tally; the partial unique index on `voting_rounds` enforces that.

**Reads are authorized.** Knowing an activity id is not permission to read a
team's work. Session-scoped handlers call `assertMember` first.

**Validation is global.** `ValidationPipe` runs with `whitelist` and
`forbidNonWhitelisted`, so unknown fields are rejected rather than passed on.

## Layout

```
backend/src/
  auth/         sign in by student ID, session token, global guard
  activities/   create, join, list, and each student's current step
  supabase/     the only place a Supabase client is created
  common/       health check, @Public()
frontend/src/
  lib/          api client, auth context
  pages/        SignIn, Dashboard, ActivityRoom
  components/   AppShell
supabase/migrations/
```

## Status

Scaffold. Sign-in, the dashboard, and create/join work end to end. The
workflow steps are not built yet.
