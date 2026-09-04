-- Lock the roster when the host starts an activity.
--
-- Students cannot join part way through: the workflow assumes a fixed team,
-- and a late arrival would change what "everyone has submitted" and "everyone
-- has voted" mean midway through a round.
--
-- Once started_at is set, joining is refused and the member count is settled,
-- so every later step can rely on it.

alter table public.activities
  add column if not exists started_at timestamptz;

-- Finding the open activity for a join code is the hot path.
create index if not exists activities_open_idx
  on public.activities (code) where started_at is null;
