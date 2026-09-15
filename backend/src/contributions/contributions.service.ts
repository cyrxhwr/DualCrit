import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ActivitiesService } from '../activities/activities.service';
import { ActivityLock } from '../activities/activity-lock';

export const CONTRIBUTION_TYPES = [
  'interview_question',
  'pov_statement',
  'hmw_question',
] as const;
export type ContributionType = (typeof CONTRIBUTION_TYPES)[number];

/**
 * Deliberately carries no author: questions are voted on anonymously, so the
 * name and the student id both stay on the server. `isMine` is enough for a
 * student to pick their own out of the list.
 */
export interface Contribution {
  id: string;
  type: ContributionType;
  content: Record<string, unknown>;
  orderIndex: number;
  isSelected: boolean;
  isMine: boolean;
}

interface ContributionRow {
  id: string;
  student_id: string;
  type: ContributionType;
  content: Record<string, unknown>;
  order_index: number;
  is_selected: boolean;
}

@Injectable()
export class ContributionsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly activities: ActivitiesService,
    private readonly lock: ActivityLock,
  ) {}

  async list(
    activityId: string,
    studentUuid: string,
    type: ContributionType,
  ): Promise<Contribution[]> {
    await this.activities.assertMember(activityId, studentUuid);

    const { data, error } = await this.supabase.client
      .from('contributions')
      .select('id, student_id, type, content, order_index, is_selected')
      .eq('activity_id', activityId)
      .eq('type', type)
      // Not created_at: with a live "n of m submitted" counter, submission
      // order is enough to work out who wrote which question. Ordering by id
      // is stable across reads but unrelated to who submitted when.
      .order('order_index', { ascending: true })
      .order('id', { ascending: true });

    if (error) throw new BadRequestException(error.message);

    return ((data ?? []) as unknown as ContributionRow[]).map((row) => ({
      id: row.id,
      type: row.type,
      content: row.content,
      orderIndex: row.order_index,
      isSelected: row.is_selected,
      isMine: row.student_id === studentUuid,
    }));
  }

  /**
   * Save a student's contribution for a slot.
   *
   * Upserted on (activity, student, type, order_index), so submitting twice
   * updates the row the student already owns. The previous system inserted a
   * new row each time, which is how a reload could add a second copy of the
   * same person's question to the team's list.
   */
  async submit(
    activityId: string,
    studentUuid: string,
    type: ContributionType,
    content: Record<string, unknown>,
    orderIndex = 1,
  ): Promise<Contribution[]> {
    await this.activities.assertMember(activityId, studentUuid);

    // In the same queue as starting a vote, so a submission cannot slip in
    // between the check below and the vote opening.
    await this.lock.run(activityId, () =>
      this.write(activityId, studentUuid, type, content, orderIndex),
    );

    return this.list(activityId, studentUuid, type);
  }

  private async write(
    activityId: string,
    studentUuid: string,
    type: ContributionType,
    content: Record<string, unknown>,
    orderIndex: number,
  ): Promise<void> {
    await this.assertOpenForSubmissions(activityId, type);

    const { error } = await this.supabase.client.from('contributions').upsert(
      {
        activity_id: activityId,
        student_id: studentUuid,
        type,
        content,
        order_index: orderIndex,
      },
      { onConflict: 'activity_id,student_id,type,order_index' },
    );

    if (error) throw new BadRequestException(error.message);
  }

  /**
   * Submissions close as soon as voting opens, not only once it finishes.
   *
   * Editing a statement mid-vote changed the words under an option that
   * teammates had already read and voted for, and whatever the edit said was
   * what got recorded if it won.
   */
  private async assertOpenForSubmissions(
    activityId: string,
    type: ContributionType,
  ): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('voting_rounds')
      .select('status')
      .eq('activity_id', activityId)
      .eq('type', type)
      .in('status', ['active', 'completed'])
      .limit(1);

    if (error) throw new BadRequestException(error.message);
    const status = data?.[0]?.status as string | undefined;
    if (status === 'completed') {
      throw new BadRequestException('Your team has already voted on these');
    }
    if (status === 'active') {
      throw new BadRequestException(
        'Voting has started, so these can no longer be changed',
      );
    }
  }
}
