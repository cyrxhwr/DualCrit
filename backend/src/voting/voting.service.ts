import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ActivitiesService } from '../activities/activities.service';
import { ActivityLock } from '../activities/activity-lock';

export const VOTE_TYPES = [
  'scenario_selection',
  'interview_question',
  'pov_statement',
  'hmw_question',
] as const;
export type VoteType = (typeof VOTE_TYPES)[number];

/**
 * How many options each vote picks. Decided here rather than taken from the
 * request: a client that opened a POV vote as "pick 3" left every normal
 * one-pick ballot rejected, and the team unable to vote at all.
 */
export const MAX_SELECTIONS: Record<VoteType, number> = {
  scenario_selection: 1,
  interview_question: 1,
  pov_statement: 1,
  hmw_question: 3,
};

/** Valid options for a scenario vote. Display text lives in the frontend. */
export const SCENARIO_TAGS = ['A', 'B', 'C', 'D'];

export interface VotingState {
  activityId: string;
  type: VoteType;
  roundId: string;
  status: 'active' | 'completed' | 'cancelled';
  maxSelections: number;
  tally: Record<string, number>;
  votedCount: number;
  memberCount: number;
  isComplete: boolean;
  winners: string[];
}

interface RoundRow {
  id: string;
  activity_id: string;
  type: VoteType;
  status: 'active' | 'completed' | 'cancelled';
  max_selections: number;
}

/** Postgres unique-violation. Here it means someone else started the round first. */
const UNIQUE_VIOLATION = '23505';

export interface VoteRow {
  student_id: string;
  option_id: string;
}

export interface Tally {
  tally: Record<string, number>;
  votedCount: number;
  isComplete: boolean;
  winners: string[];
}

/**
 * Count a round. Pure, so it can be tested without a database — this is the
 * calculation that decides what a team ends up working on.
 *
 * A member counts as having voted once they have any row.
 *
 * The team picks `maxSelections` options, so `winners` is every option scoring
 * at least as well as the last of those places. When that is exactly
 * `maxSelections` options, the choice is settled. When it is more, some are
 * level for the final place — a tie, visible rather than resolved by whichever
 * option happened to sort first. With one pick this is simply everything on
 * the top score.
 *
 * Counting only the top score was wrong for a pick of three: votes of 4, 3 and
 * 2 recorded one question as the team's choice instead of three.
 */
export function computeTally(
  rows: VoteRow[],
  memberCount: number,
  maxSelections = 1,
): Tally {
  const tally: Record<string, number> = {};
  const voters = new Set<string>();

  for (const row of rows) {
    tally[row.option_id] = (tally[row.option_id] ?? 0) + 1;
    voters.add(row.student_id);
  }

  const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  const places = Math.min(Math.max(1, maxSelections), ranked.length);
  const cutoff = ranked[places - 1]?.[1] ?? 0;

  return {
    tally,
    votedCount: voters.size,
    isComplete: memberCount > 0 && voters.size >= memberCount,
    winners: ranked.filter(([, n]) => n > 0 && n >= cutoff).map(([id]) => id),
  };
}

@Injectable()
export class VotingService {
  private readonly logger = new Logger(VotingService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly activities: ActivitiesService,
    private readonly lock: ActivityLock,
  ) {}

  /**
   * Start a round, or return the one already running.
   *
   * This is deliberately idempotent. In the previous system the equivalent
   * call unconditionally reset the tally, and a component that auto-started
   * voting on mount meant every member's arrival wiped everyone's votes.
   *
   * Two students starting at the same instant is handled by the database:
   * the partial unique index allows only one active round per (activity,
   * type), so the loser gets a unique violation and reads the winner's round
   * instead of creating a second one.
   */
  async startOrGet(
    activityId: string,
    studentUuid: string,
    type: VoteType,
  ): Promise<VotingState> {
    await this.activities.assertMember(activityId, studentUuid);
    return this.lock.run(activityId, () =>
      this.startUnlocked(activityId, studentUuid, type),
    );
  }

  private async startUnlocked(
    activityId: string,
    studentUuid: string,
    type: VoteType,
  ): Promise<VotingState> {
    const existing = await this.findLatestRound(activityId, type);
    if (existing && existing.status === 'active') {
      return this.buildState(existing);
    }

    const { data, error } = await this.supabase.client
      .from('voting_rounds')
      .insert({
        activity_id: activityId,
        type,
        max_selections: MAX_SELECTIONS[type],
        started_by: studentUuid,
      })
      .select('id, activity_id, type, status, max_selections')
      .single<RoundRow>();

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        const winner = await this.findLatestRound(activityId, type);
        if (winner) return this.buildState(winner);
      }
      throw new BadRequestException(error.message);
    }

    return this.buildState(data);
  }

  /** The current round and tally, or null if voting has not started. */
  async getState(
    activityId: string,
    studentUuid: string,
    type: VoteType,
  ): Promise<VotingState | null> {
    await this.activities.assertMember(activityId, studentUuid);
    const round = await this.findLatestRound(activityId, type);
    return round ? this.buildState(round) : null;
  }

  /** The options this student picked, so their selection survives a reload. */
  async getMyVote(
    activityId: string,
    studentUuid: string,
    type: VoteType,
  ): Promise<string[]> {
    const round = await this.findLatestRound(activityId, type);
    if (!round) return [];

    const { data, error } = await this.supabase.client
      .from('votes')
      .select('option_id')
      .eq('round_id', round.id)
      .eq('student_id', studentUuid);

    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => row.option_id as string);
  }

  /**
   * Record this student's choices, replacing anything they picked before.
   *
   * Votes are rows keyed by (round, student, option), so two students voting
   * at the same moment touch different rows and cannot overwrite each other.
   * That is what removes the need for the mutex the previous system had.
   */
  async castVote(
    activityId: string,
    studentUuid: string,
    type: VoteType,
    optionIds: string[],
  ): Promise<VotingState> {
    await this.activities.assertMember(activityId, studentUuid);
    // One vote at a time per activity: the check that the round is open, the
    // write, and the decision to close it must not interleave with anyone
    // else's.
    return this.lock.run(activityId, () =>
      this.castUnlocked(activityId, studentUuid, type, optionIds),
    );
  }

  private async castUnlocked(
    activityId: string,
    studentUuid: string,
    type: VoteType,
    optionIds: string[],
  ): Promise<VotingState> {
    const round = await this.findLatestRound(activityId, type);
    if (!round || round.status !== 'active') {
      throw new BadRequestException('Voting is not open');
    }

    const chosen = [...new Set(optionIds)];
    if (chosen.length !== round.max_selections) {
      throw new BadRequestException(
        `Choose exactly ${round.max_selections} option${round.max_selections === 1 ? '' : 's'}`,
      );
    }

    await this.assertOptionsExist(round, chosen);

    // Add the new picks first, then remove this student's other rows; nobody
    // else's are touched. In this order:
    //   - resending the same vote is harmless, where a double-clicked button
    //     used to surface a raw duplicate-key error;
    //   - the student is never briefly counted as not having voted;
    //   - two of their requests racing can leave them fewer votes than they
    //     are allowed, but never more — the lock prevents even that here.
    const { error: insertError } = await this.supabase.client
      .from('votes')
      .upsert(
        chosen.map((optionId) => ({
          round_id: round.id,
          student_id: studentUuid,
          option_id: optionId,
        })),
        { onConflict: 'round_id,student_id,option_id', ignoreDuplicates: true },
      );

    if (insertError) throw new BadRequestException(insertError.message);

    const { error: clearError } = await this.supabase.client
      .from('votes')
      .delete()
      .eq('round_id', round.id)
      .eq('student_id', studentUuid)
      .not('option_id', 'in', `(${chosen.map((id) => `"${id}"`).join(',')})`);

    if (clearError) throw new BadRequestException(clearError.message);

    const state = await this.buildState(round);
    return state.isComplete ? this.complete(round, state) : state;
  }

  private async findLatestRound(
    activityId: string,
    type: VoteType,
  ): Promise<RoundRow | null> {
    const { data, error } = await this.supabase.client
      .from('voting_rounds')
      .select('id, activity_id, type, status, max_selections')
      .eq('activity_id', activityId)
      .eq('type', type)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw new BadRequestException(error.message);
    return (data?.[0] as RoundRow | undefined) ?? null;
  }

  /** A vote must name something real, whether a scenario tag or a contribution. */
  private async assertOptionsExist(
    round: RoundRow,
    optionIds: string[],
  ): Promise<void> {
    if (round.type === 'scenario_selection') {
      const unknown = optionIds.filter((id) => !SCENARIO_TAGS.includes(id));
      if (unknown.length) {
        throw new BadRequestException(`Unknown option: ${unknown.join(', ')}`);
      }
      return;
    }

    const { data, error } = await this.supabase.client
      .from('contributions')
      .select('id')
      .eq('activity_id', round.activity_id)
      .in('id', optionIds);

    if (error) throw new BadRequestException(error.message);
    if ((data?.length ?? 0) !== optionIds.length) {
      throw new BadRequestException('That option is no longer available');
    }
  }

  private async buildState(round: RoundRow): Promise<VotingState> {
    const [{ data: votes, error }, members] = await Promise.all([
      this.supabase.client
        .from('votes')
        .select('student_id, option_id')
        .eq('round_id', round.id),
      this.activities.listMembers(round.activity_id),
    ]);

    if (error) throw new BadRequestException(error.message);

    const counted = computeTally(
      (votes ?? []) as VoteRow[],
      members.length,
      round.max_selections,
    );

    return {
      activityId: round.activity_id,
      type: round.type,
      roundId: round.id,
      status: round.status,
      maxSelections: round.max_selections,
      memberCount: members.length,
      ...counted,
    };
  }

  /**
   * Close the round and record what the team chose.
   *
   * A tie leaves the round active so the team can decide, rather than the
   * server picking arbitrarily on their behalf.
   */
  private async complete(
    round: RoundRow,
    state: VotingState,
  ): Promise<VotingState> {
    if (state.winners.length > round.max_selections) {
      this.logger.log(`Round ${round.id} is tied; leaving it open`);
      return state;
    }

    const { data: closed, error } = await this.supabase.client
      .from('voting_rounds')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', round.id)
      .eq('status', 'active')
      .select('id');

    if (error) throw new BadRequestException(error.message);

    // Only the request that actually closed the round records the outcome.
    // Checking the status in the filter was not enough on its own: both of
    // two simultaneous final votes went on to record a selection, and two
    // statements ended up marked as the team's choice.
    if (!closed?.length) {
      const latest = await this.findLatestRound(round.activity_id, round.type);
      return this.buildState(latest ?? { ...round, status: 'completed' });
    }

    await this.recordSelection(round, state.winners);

    return { ...state, status: 'completed' };
  }

  /** Denormalise the outcome onto the activity, so later steps can read it. */
  private async recordSelection(
    round: RoundRow,
    winners: string[],
  ): Promise<void> {
    const patch: Record<string, unknown> = {};

    if (round.type === 'scenario_selection') {
      patch.selected_scenario_tag = winners[0];
    } else {
      const { data } = await this.supabase.client
        .from('contributions')
        .select('id, content')
        .in('id', winners);

      const texts = (data ?? []).map((row) => {
        const content = row.content as {
          question?: string;
          statement?: string;
        };
        return content.question ?? content.statement ?? '';
      });

      if (round.type === 'interview_question') {
        patch.selected_question_content = texts[0];
      } else if (round.type === 'pov_statement') {
        patch.selected_pov_content = texts[0];
      } else {
        patch.selected_hmw_contents = texts;
      }

      // Clear the type first, so exactly the winners end up selected even if
      // an earlier bug left another option marked.
      await this.supabase.client
        .from('contributions')
        .update({ is_selected: false })
        .eq('activity_id', round.activity_id)
        .eq('type', round.type);

      await this.supabase.client
        .from('contributions')
        .update({ is_selected: true })
        .in('id', winners);
    }

    const { error } = await this.supabase.client
      .from('activities')
      .update(patch)
      .eq('id', round.activity_id);

    if (error) throw new BadRequestException(error.message);
  }
}
