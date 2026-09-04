import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface ActivitySummary {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
  updatedAt: string;
  currentStep: string | null;
  isHost: boolean;
  members: string[];
}

interface ActivityRow {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
  max_participants: number;
  updated_at: string;
}

interface MemberRow {
  activity_id: string;
  student_id: string;
  is_host: boolean;
  current_step: string | null;
  students: { full_name: string } | null;
}

@Injectable()
export class ActivitiesService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Everything the dashboard needs, in two queries rather than N. */
  async listForStudent(studentUuid: string): Promise<ActivitySummary[]> {
    const { data: mine, error: mineError } = await this.supabase.client
      .from('activity_members')
      .select('activity_id, is_host, current_step')
      .eq('student_id', studentUuid)
      .eq('is_active', true);

    if (mineError) throw new BadRequestException(mineError.message);
    if (!mine || mine.length === 0) return [];

    const activityIds = mine.map((m) => m.activity_id as string);

    const { data: activities, error: activitiesError } =
      await this.supabase.client
        .from('activities')
        .select('id, code, name, type, status, max_participants, updated_at')
        .in('id', activityIds)
        .neq('status', 'archived')
        .order('updated_at', { ascending: false });

    if (activitiesError) throw new BadRequestException(activitiesError.message);

    // One query for every member of every activity, then grouped in memory —
    // rather than a request per activity.
    const { data: members, error: membersError } = await this.supabase.client
      .from('activity_members')
      .select('activity_id, student_id, is_host, current_step, students(full_name)')
      .in('activity_id', activityIds)
      .eq('is_active', true);

    if (membersError) throw new BadRequestException(membersError.message);

    const namesByActivity = new Map<string, string[]>();
    for (const row of (members ?? []) as unknown as MemberRow[]) {
      const list = namesByActivity.get(row.activity_id) ?? [];
      if (row.students?.full_name) list.push(row.students.full_name);
      namesByActivity.set(row.activity_id, list);
    }

    const mineById = new Map(mine.map((m) => [m.activity_id as string, m]));

    return ((activities ?? []) as ActivityRow[]).map((a) => {
      const membership = mineById.get(a.id);
      return {
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        status: a.status,
        updatedAt: a.updated_at,
        currentStep: (membership?.current_step as string | null) ?? null,
        isHost: Boolean(membership?.is_host),
        members: namesByActivity.get(a.id) ?? [],
      };
    });
  }

  /** Create an activity and enrol the creator as host. */
  async create(studentUuid: string, name: string): Promise<ActivitySummary> {
    const { data: activity, error } = await this.supabase.client
      .from('activities')
      .insert({ name, host_id: studentUuid })
      .select('id, code, name, type, status, max_participants, updated_at')
      .single<ActivityRow>();

    if (error || !activity) {
      throw new BadRequestException(
        error?.message ?? 'Could not create the activity',
      );
    }

    await this.addMember(activity.id, studentUuid, true);
    const list = await this.listForStudent(studentUuid);
    return list.find((a) => a.id === activity.id)!;
  }

  /** Join by code. Rejoining is safe: the member row is upserted. */
  async join(studentUuid: string, rawCode: string): Promise<ActivitySummary> {
    const code = rawCode.trim().toUpperCase();

    const { data: activity, error } = await this.supabase.client
      .from('activities')
      .select('id, code, name, type, status, max_participants, updated_at')
      .eq('code', code)
      .eq('status', 'active')
      .maybeSingle<ActivityRow>();

    if (error) throw new BadRequestException(error.message);
    if (!activity) {
      throw new NotFoundException('No open activity with that code');
    }

    // A returning member is already counted, so only check capacity for
    // someone genuinely new. This is the bug that stopped students rejoining
    // a full team in the previous system.
    const { data: existing } = await this.supabase.client
      .from('activity_members')
      .select('student_id')
      .eq('activity_id', activity.id)
      .eq('student_id', studentUuid)
      .maybeSingle();

    if (!existing) {
      const { count, error: countError } = await this.supabase.client
        .from('activity_members')
        .select('student_id', { count: 'exact', head: true })
        .eq('activity_id', activity.id)
        .eq('is_active', true);

      if (countError) throw new BadRequestException(countError.message);
      if ((count ?? 0) >= activity.max_participants) {
        throw new ForbiddenException('That activity is full');
      }
    }

    await this.addMember(activity.id, studentUuid, false);
    const list = await this.listForStudent(studentUuid);
    return list.find((a) => a.id === activity.id)!;
  }

  /** Records where a student is, so the dashboard can send them back there. */
  async setStep(
    activityId: string,
    studentUuid: string,
    step: string,
  ): Promise<void> {
    await this.assertMember(activityId, studentUuid);

    const { error } = await this.supabase.client
      .from('activity_members')
      .update({ current_step: step, step_updated_at: new Date().toISOString() })
      .eq('activity_id', activityId)
      .eq('student_id', studentUuid);

    if (error) throw new BadRequestException(error.message);
  }

  /**
   * Every activity-scoped read goes through this. Knowing an id is not
   * permission to read a team's work.
   */
  async assertMember(activityId: string, studentUuid: string): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('activity_members')
      .select('student_id')
      .eq('activity_id', activityId)
      .eq('student_id', studentUuid)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new ForbiddenException('You are not in this activity');
  }

  private async addMember(
    activityId: string,
    studentUuid: string,
    isHost: boolean,
  ): Promise<void> {
    const { error } = await this.supabase.client
      .from('activity_members')
      .upsert(
        {
          activity_id: activityId,
          student_id: studentUuid,
          is_host: isHost,
          is_active: true,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'activity_id,student_id' },
      );

    if (error) throw new BadRequestException(error.message);
  }
}
