-- One evaluation of each type per student per activity.
--
-- The team-scoped index already prevents duplicate team evaluations. This is
-- its per-student counterpart: without it, two requests racing on a student's
-- interview feedback would each pay for a model call and store both results,
-- and later reads would have to pick between them arbitrarily.

create unique index if not exists ai_evaluations_one_user_idx
  on public.ai_evaluations (activity_id, student_id, evaluation_type)
  where scope = 'user';
