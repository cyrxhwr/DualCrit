import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ActivitiesService } from '../activities/activities.service';

export const CONTRIBUTION_TYPES = [
  'interview_question',
  'pov_statement',
  'hmw_question',
] as const;
export type ContributionType = (typeof CONTRIBUTION_TYPES)[number];

export interface Contribution {
  id: string;
  studentUuid: string;
  authorName: string;
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
  students: { full_name: string } | null;
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
      .select(
        'id, student_id, type, content, order_index, is_selected, students(full_name)',
      )
      .eq('activity_id', activityId)
      .eq('type', type)
      .order('created_at', { ascending: true });

    if (error) throw new BadRequestException(error.message);

    return ((data ?? []) as unknown as ContributionRow[]).map((row) => ({
      id: row.id,
      studentUuid: row.student_id,
      authorName: row.students?.full_name ?? 'Student',
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
