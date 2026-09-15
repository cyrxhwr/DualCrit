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

describe('computeTally with several picks', () => {
  // Four students, each picking three questions.
  const ballots = (picks: string[][]) =>
    picks.flatMap((options, i) =>
      options.map((option_id) => ({ student_id: `s${i + 1}`, option_id })),
    );

  it('keeps the top three when the ranking is clear', () => {
    const result = computeTally(
      ballots([
        ['Q1', 'Q2', 'Q3'],
        ['Q1', 'Q2', 'Q3'],
        ['Q1', 'Q2', 'Q4'],
        ['Q1', 'Q5', 'Q6'],
      ]),
      4,
      3,
    );

    // 4, 3, 2 and then 1s: counting only the top score used to keep just Q1.
    expect(result.winners).toEqual(['Q1', 'Q2', 'Q3']);
  });

  it('reports a tie for the last place as more winners than places', () => {
    const result = computeTally(
      ballots([
        ['Q1', 'Q2', 'Q3'],
        ['Q1', 'Q2', 'Q4'],
        ['Q1', 'Q2', 'Q5'],
        ['Q3', 'Q4', 'Q6'],
      ]),
      4,
      3,
    );

    // Q1 and Q2 are settled; Q3 and Q4 are level for the third place.
    expect(result.winners.sort()).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
  });

  it('does not settle on two when three are wanted and the rest are level', () => {
    const result = computeTally(
      ballots([
        ['Q1', 'Q2', 'Q3'],
        ['Q1', 'Q2', 'Q4'],
        ['Q5', 'Q6', 'Q7'],
        ['Q8', 'Q9', 'Q10'],
      ]),
      4,
      3,
    );

    expect(result.winners.length).toBeGreaterThan(3);
  });

  it('keeps a single pick exactly as before', () => {
    const rows = [
      { student_id: 's1', option_id: 'A' },
      { student_id: 's2', option_id: 'A' },
      { student_id: 's3', option_id: 'B' },
    ];

    expect(computeTally(rows, 3, 1).winners).toEqual(['A']);
    expect(computeTally(rows, 3).winners).toEqual(['A']);
  });
});
