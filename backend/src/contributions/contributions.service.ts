import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ActivitiesService } from '../activities/activities.service';

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
    await this.assertNotDecided(activityId, type);

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

    return this.list(activityId, studentUuid, type);
  }

  /**
   * Once the team has voted, the options are settled. Editing a question
   * after it won would change what everyone agreed to.
   */
  private async assertNotDecided(
    activityId: string,
    type: ContributionType,
  ): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('voting_rounds')
      .select('status')
      .eq('activity_id', activityId)
      .eq('type', type)
      .eq('status', 'completed')
      .limit(1);

    if (error) throw new BadRequestException(error.message);
    if ((data?.length ?? 0) > 0) {
      throw new BadRequestException('Your team has already voted on these');
    }
  }
}
