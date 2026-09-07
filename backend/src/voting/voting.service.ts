import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ActivitiesService } from '../activities/activities.service';

export const VOTE_TYPES = [
  'scenario_selection',
  'interview_question',
  'pov_statement',
  'hmw_question',
] as const;
export type VoteType = (typeof VOTE_TYPES)[number];

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
 * A member counts as having voted once they have any row, and `winners` holds
 * everything on the top score, so a tie is visible rather than resolved by
 * whichever option happened to sort first.
 */
export function computeTally(rows: VoteRow[], memberCount: number): Tally {
  const tally: Record<string, number> = {};
  const voters = new Set<string>();

  for (const row of rows) {
    tally[row.option_id] = (tally[row.option_id] ?? 0) + 1;
    voters.add(row.student_id);
  }

  const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  const topScore = ranked[0]?.[1] ?? 0;

  return {
    tally,
    votedCount: voters.size,
    isComplete: memberCount > 0 && voters.size >= memberCount,
    winners: ranked.filter(([, n]) => n === topScore).map(([id]) => id),
  };
}

@Injectable()
export class VotingService {
  private readonly logger = new Logger(VotingService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly activities: ActivitiesService,
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
    maxSelections = 1,
  ): Promise<VotingState> {
    await this.activities.assertMember(activityId, studentUuid);

    const existing = await this.findLatestRound(activityId, type);
    if (existing && existing.status === 'active') {
      return this.buildState(existing);
    }

    const { data, error } = await this.supabase.client
      .from('voting_rounds')
      .insert({
        activity_id: activityId,
        type,
        max_selections: maxSelections,
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

    // Replacing this student's own rows only; nobody else's are touched.
    const { error: clearError } = await this.supabase.client
      .from('votes')
      .delete()
      .eq('round_id', round.id)
      .eq('student_id', studentUuid);

    if (clearError) throw new BadRequestException(clearError.message);

    const { error: insertError } = await this.supabase.client
      .from('votes')
      .insert(
        chosen.map((optionId) => ({
          round_id: round.id,
          student_id: studentUuid,
          option_id: optionId,
        })),
      );

    if (insertError) throw new BadRequestException(insertError.message);

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

    const counted = computeTally((votes ?? []) as VoteRow[], members.length);

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

    const { error } = await this.supabase.client
      .from('voting_rounds')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', round.id)
      .eq('status', 'active'); // only the first caller closes it

    if (error) throw new BadRequestException(error.message);

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
