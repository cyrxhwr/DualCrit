import { computeTally } from './voting.service';

describe('computeTally', () => {
  it('counts votes per option', () => {
    const result = computeTally(
      [
        { student_id: 's1', option_id: 'A' },
        { student_id: 's2', option_id: 'A' },
        { student_id: 's3', option_id: 'B' },
      ],
      3,
    );

    expect(result.tally).toEqual({ A: 2, B: 1 });
    expect(result.winners).toEqual(['A']);
  });

  it('counts a member once even when they pick several options', () => {
    const result = computeTally(
      [
        { student_id: 's1', option_id: 'A' },
        { student_id: 's1', option_id: 'B' },
        { student_id: 's1', option_id: 'C' },
      ],
      2,
    );

    expect(result.votedCount).toBe(1);
    expect(result.isComplete).toBe(false);
  });

  it('is complete once every member has voted', () => {
    const rows = [
      { student_id: 's1', option_id: 'A' },
      { student_id: 's2', option_id: 'B' },
    ];

    expect(computeTally(rows, 2).isComplete).toBe(true);
    expect(computeTally(rows, 3).isComplete).toBe(false);
  });

  it('reports every option on the top score, so a tie stays visible', () => {
    const result = computeTally(
      [
        { student_id: 's1', option_id: 'A' },
        { student_id: 's2', option_id: 'B' },
      ],
      2,
    );

    expect(result.winners.sort()).toEqual(['A', 'B']);
  });

  it('is never complete before anyone joins', () => {
    expect(computeTally([], 0).isComplete).toBe(false);
  });

  it('handles a round with no votes yet', () => {
    const result = computeTally([], 4);

    expect(result.tally).toEqual({});
    expect(result.votedCount).toBe(0);
    expect(result.winners).toEqual([]);
  });
});
