import { consensus, EVAL_SAMPLES } from './consensus';
import type { InterviewFeedback } from './evaluations.service';

const sample = (...scores: number[]): InterviewFeedback => ({
  criteria: scores.map((score, i) => ({
    standard: `S${i}`,
    score,
    response: `said ${score}`,
  })),
});

describe('EVAL_SAMPLES', () => {
  it('scores a transcript once unless overridden', () => {
    expect(EVAL_SAMPLES).toBe(1);
  });
});

describe('consensus', () => {
  it('takes the median score across samples', () => {
    const out = consensus([sample(4), sample(2), sample(2)]);
    expect(out.criteria[0].score).toBe(2);
  });

  it('ignores an outlier rather than averaging it in', () => {
    // A mean would report 3; the median reports what two of three agreed on.
    const out = consensus([sample(2), sample(2), sample(5)]);
    expect(out.criteria[0].score).toBe(2);
  });

  it('keeps the wording of the sample that matches the reported score', () => {
    const out = consensus([sample(5), sample(3), sample(3)]);
    expect(out.criteria[0].score).toBe(3);
    expect(out.criteria[0].response).toBe('said 3');
  });

  it('scores every criterion independently', () => {
    const out = consensus([sample(1, 5, 3), sample(4, 5, 2), sample(4, 1, 3)]);
    expect(out.criteria.map((c) => c.score)).toEqual([4, 5, 3]);
  });

  it('passes a single sample through untouched', () => {
    const one = sample(3, 4);
    expect(consensus([one])).toEqual(one);
  });

  it('survives a sample that omits a criterion', () => {
    const partial: InterviewFeedback = {
      criteria: [{ standard: 'S0', score: 5, response: 'only one' }],
    };
    const out = consensus([sample(1, 2), partial, sample(1, 2)]);
    expect(out.criteria).toHaveLength(2);
    expect(out.criteria[0].score).toBe(1);
    expect(out.criteria[1].score).toBe(2);
  });

  it('drops a non-numeric score instead of poisoning the median', () => {
    const bad = {
      criteria: [{ standard: 'S0', score: 'high', response: 'x' }],
    } as unknown as InterviewFeedback;
    const out = consensus([sample(2), bad, sample(4)]);
    expect(out.criteria[0].score).toBe(4);
  });

  it('returns nothing rather than throwing when every sample is unusable', () => {
    expect(consensus([])).toEqual({ criteria: [] });
    expect(consensus([{} as InterviewFeedback])).toEqual({ criteria: [] });
  });
});
