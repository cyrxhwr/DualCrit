import type { Criterion, InterviewFeedback } from './evaluations.service';

/**
 * How many times a transcript is scored before the scores are combined.
 *
 * One, by choice (owner, 2026-09-05): a transcript is scored once and that
 * score stands.
 *
 * The trade-off that decision accepts, so nobody has to re-derive it: because
 * the prompt has the model reason before it commits to a number, the score
 * carries the reasoning's variance. Measured on one fixed transcript, repeated
 * single calls ranged up to two points on a five-point rubric, and the mean
 * across five criteria moved between 2.4 and 3.2. Medians of three runs held
 * four of the five criteria exactly steady. So a single score is well grounded
 * but noisy, and two students with comparable interviews can land a point
 * apart.
 *
 * Set EVAL_SAMPLES=3 to turn the aggregation back on — for a final data
 * collection run, say — at three times the cost of the interview evaluation.
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
