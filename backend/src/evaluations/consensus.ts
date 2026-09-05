import type { Criterion, InterviewFeedback } from './evaluations.service';

/**
 * How many times a transcript is scored before the scores are combined.
 *
 * One (owner, 2026-09-05). A transcript is scored once and that score stands.
 *
 * The history matters, because the obvious reading of "1" is that nobody
 * thought about it. Scoring once was noisy enough that two sittings of the
 * same interview returned means of 4.8 and 3.4. The cause turned out to be
 * the rubric anchors, not the sampling: the grader was treating "could have
 * been more specific" as a clear violation and dropping three levels for it.
 * Once the anchors separated meeting the standard from being perfect, single
 * scoring measured stable on both transcripts tested — two independent
 * sessions of the same interview agreed on every criterion.
 *
 * So sampling was insurance against a problem that had already been fixed
 * somewhere else, and it is off.
 *
 * What to watch: the prompt still has the model reason before it commits to a
 * number, so a score can in principle inherit the reasoning's variance. If
 * marks start swinging between sittings again, EVAL_SAMPLES=3 takes the median
 * of three at three times the cost of this one call — once per student, not
 * per turn — and consensus() below is already written for it.
 */
export const EVAL_SAMPLES = Number(process.env.EVAL_SAMPLES ?? 1);

const median = (values: number[]): number =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/**
 * Combine several independent scorings of one transcript.
 *
 * The score is the median across samples, which is what makes the result
 * reproducible. The prose is not averaged — there is no meaningful average of
 * two explanations — so each criterion keeps the wording from whichever sample
 * scored it closest to the median, and ties go to the earliest. That keeps the
 * number a student sees consistent with the sentence explaining it.
 *
 * Samples that disagree about which criteria exist are ignored for the
 * criteria they omit; a criterion is reported if any sample scored it, using
 * the order of the first sample that did.
 */
export function consensus(samples: InterviewFeedback[]): InterviewFeedback {
  const usable = samples.filter((s) => Array.isArray(s?.criteria));
  if (usable.length === 0) return { criteria: [] };
  if (usable.length === 1) return usable[0];

  const order: string[] = [];
  const byStandard = new Map<string, Criterion[]>();

  for (const sample of usable) {
    for (const criterion of sample.criteria) {
      if (typeof criterion?.standard !== 'string') continue;
      if (typeof criterion.score !== 'number' || !isFinite(criterion.score)) {
        continue;
      }
      if (!byStandard.has(criterion.standard)) {
        byStandard.set(criterion.standard, []);
        order.push(criterion.standard);
      }
      byStandard.get(criterion.standard)!.push(criterion);
    }
  }

  return {
    criteria: order.map((standard) => {
      const scored = byStandard.get(standard)!;
      const agreed = median(scored.map((c) => c.score));

      let best = scored[0];
      let bestGap = Math.abs(best.score - agreed);
      for (const candidate of scored.slice(1)) {
        const gap = Math.abs(candidate.score - agreed);
        if (gap < bestGap) {
          best = candidate;
          bestGap = gap;
        }
      }

      return { standard, score: agreed, response: best.response };
    }),
  };
}
