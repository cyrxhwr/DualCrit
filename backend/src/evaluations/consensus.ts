import type { Criterion, InterviewFeedback } from './evaluations.service';

/**
 * How many times a transcript is scored before the scores are combined.
 *
 * Three. This was briefly 1 (owner, 2026-09-05) and went back to 3 the same
 * day, after two sessions of the same interview returned means of 4.8 and 3.4
 * — one criterion moving 5 to 3 and another 4 to 2. Single-sample scoring is
 * simply too noisy to put in front of a student as a mark.
 *
 * Why one sample drifts: the prompt has the model reason before it commits to
 * a number, so the score inherits the reasoning's variance. That ordering is
 * worth keeping — it is what makes the number follow from the analysis rather
 * than precede it — so the variance is handled by sampling instead.
 *
 * Measured on one fixed transcript: single samples ranged up to two points
 * across the five criteria, medians of three moved by at most one on one
 * criterion.
 *
 * EVAL_SAMPLES=1 restores single scoring at a third of the cost, and this is
 * the only interview call that pays it — once per student, not per turn.
 */
export const EVAL_SAMPLES = Number(process.env.EVAL_SAMPLES ?? 3);

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
