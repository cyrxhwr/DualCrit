import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { ActivityType } from './dto/create-activity.dto';
import { ActivityLock } from './activity-lock';

export interface ActivitySummary {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
  updatedAt: string;
  currentStep: string | null;
  startedAt: string | null;
  selectedScenarioTag: string | null;
  selectedPovContent: string | null;
  selectedHmwContents: string[] | null;
  /** True once the host has recorded the team's needs and insights. */
  needsInsightsSet: boolean;
  selectedQuestionContent: string | null;
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
  selected_scenario_tag: string | null;
  selected_question_content: string | null;
  selected_pov_content: string | null;
  selected_hmw_contents: string[] | null;
  pov_hmw_data: { activity_id: string } | { activity_id: string }[] | null;
  started_at: string | null;
}

interface MemberRow {
  activity_id: string;
  student_id: string;
  is_host: boolean;
  current_step: string | null;
  students: { full_name: string } | null;
}

export interface ActivityMember {
  studentUuid: string;
  fullName: string;
  isHost: boolean;
  currentStep: string | null;
}

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly lock: ActivityLock,
  ) {}

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
        .select(
          'id, code, name, type, status, max_participants, updated_at, selected_scenario_tag, selected_question_content, selected_pov_content, selected_hmw_contents, started_at, pov_hmw_data(activity_id)',
        )
        .in('id', activityIds)
        .neq('status', 'archived')
        .order('updated_at', { ascending: false });

    if (activitiesError) throw new BadRequestException(activitiesError.message);

    // One query for every member of every activity, then grouped in memory —
    // rather than a request per activity.
    const { data: members, error: membersError } = await this.supabase.client
      .from('activity_members')
      .select(
        'activity_id, student_id, is_host, current_step, students(full_name)',
      )
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
        startedAt: a.started_at,
        selectedScenarioTag: a.selected_scenario_tag,
        selectedQuestionContent: a.selected_question_content,
        selectedPovContent: a.selected_pov_content,
        selectedHmwContents: a.selected_hmw_contents,
        // PostgREST returns an embedded one-to-one as an object, but an array
        // if it decides the relationship is to-many; accept either.
        needsInsightsSet: Array.isArray(a.pov_hmw_data)
          ? a.pov_hmw_data.length > 0
          : a.pov_hmw_data !== null,
        currentStep: (membership?.current_step as string | null) ?? null,
        isHost: Boolean(membership?.is_host),
        members: namesByActivity.get(a.id) ?? [],
      };
    });
  }

  /**
   * Create an activity and enrol the creator as host.
   *
   * The workflow type is fixed here, once. It describes the team's work, so
   * it cannot be a per-student choice made later — that is how two members
   * of one team ended up in different flows in the previous system.
   */
  async create(
    studentUuid: string,
    name: string,
    type: ActivityType,
  ): Promise<ActivitySummary> {
    const { data: activity, error } = await this.supabase.client
      .from('activities')
      .insert({ name, type, host_id: studentUuid })
      .select(
        'id, code, name, type, status, max_participants, updated_at, selected_scenario_tag, selected_question_content, selected_pov_content, selected_hmw_contents, started_at, pov_hmw_data(activity_id)',
      )
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
      .select(
        'id, code, name, type, status, max_participants, updated_at, selected_scenario_tag, selected_question_content, selected_pov_content, selected_hmw_contents, started_at, pov_hmw_data(activity_id)',
      )
      .eq('code', code)
      .eq('status', 'active')
      .maybeSingle<ActivityRow>();

    if (error) throw new BadRequestException(error.message);
    if (!activity) {
      throw new NotFoundException('No open activity with that code');
    }

    // Checked and written under the activity's lock: counting seats and then
    // taking one are two steps, and six students joining a four-seat team at
    // once all counted three and all got in.
    await this.lock.run(activity.id, async () => {
      // Re-read under the lock: the host may have started while this request
      // waited its turn.
      const { data: fresh, error: freshError } = await this.supabase.client
        .from('activities')
        .select('started_at')
        .eq('id', activity.id)
        .single<{ started_at: string | null }>();
      if (freshError) throw new BadRequestException(freshError.message);

      // The roster is fixed once the host starts. A late arrival would change
      // what "everyone has submitted" and "everyone has voted" mean in the
      // middle of a round, so joining is refused rather than silently allowed.
      if (fresh.started_at) {
        throw new ForbiddenException('That activity has already started');
      }

      const { data: existing } = await this.supabase.client
        .from('activity_members')
        .select('student_id')
        .eq('activity_id', activity.id)
        .eq('student_id', studentUuid)
        .maybeSingle();

      // A returning member keeps their seat and their role. Writing the row
      // afresh set is_host to false, so a host who re-entered their own code
      // stopped being host, and nobody else could become one.
      if (existing) {
        await this.reactivateMember(activity.id, studentUuid);
        return;
      }

      // Only someone genuinely new needs a seat. This is the bug that stopped
      // students rejoining a full team in the previous system.
      const { count, error: countError } = await this.supabase.client
        .from('activity_members')
        .select('student_id', { count: 'exact', head: true })
        .eq('activity_id', activity.id)
        .eq('is_active', true);

      if (countError) throw new BadRequestException(countError.message);
      if ((count ?? 0) >= activity.max_participants) {
        throw new ForbiddenException('That activity is full');
      }

      await this.addMember(activity.id, studentUuid, false);
      await this.giveUpSeatIfOverCapacity(
        activity.id,
        studentUuid,
        activity.max_participants,
      );
    });

    const list = await this.listForStudent(studentUuid);
    return list.find((a) => a.id === activity.id)!;
  }

  /**
   * The database-level backstop for capacity.
   *
   * The lock only serialises requests inside one server process. If joins
   * ever raced across processes, every new member re-checks after taking a
   * seat, and whoever arrived after the limit gives it back. Seats are
   * ordered by arrival, so every request agrees on who is over.
   */
  private async giveUpSeatIfOverCapacity(
    activityId: string,
    studentUuid: string,
    capacity: number,
  ): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('activity_members')
      .select('student_id')
      .eq('activity_id', activityId)
      .eq('is_active', true)
      .order('joined_at', { ascending: true })
      .order('student_id', { ascending: true });

    if (error) throw new BadRequestException(error.message);

    const seat = (data ?? []).findIndex((m) => m.student_id === studentUuid);
    if (seat >= capacity) {
      await this.supabase.client
        .from('activity_members')
        .delete()
        .eq('activity_id', activityId)
        .eq('student_id', studentUuid)
        .eq('is_host', false);
      throw new ForbiddenException('That activity is full');
    }
  }

  /**
   * The host starts the activity, which locks the roster and moves the whole
   * team on together.
   *
   * Only the host can do it: leaving it to whoever clicked first meant a
   * student could start the team on a workflow before everyone had arrived.
   * Idempotent — starting twice keeps the original time rather than resetting.
   */
  async start(activityId: string, studentUuid: string): Promise<void> {
    // Same queue as joining, so a join and the start cannot cross.
    await this.lock.run(activityId, () =>
      this.startUnlocked(activityId, studentUuid),
    );
  }

  private async startUnlocked(
    activityId: string,
    studentUuid: string,
  ): Promise<void> {
    const { data: membership, error: membershipError } =
      await this.supabase.client
        .from('activity_members')
        .select('is_host')
        .eq('activity_id', activityId)
        .eq('student_id', studentUuid)
        .eq('is_active', true)
        .maybeSingle<{ is_host: boolean }>();

    if (membershipError) throw new BadRequestException(membershipError.message);
    if (!membership)
      throw new ForbiddenException('You are not in this activity');
    if (!membership.is_host) {
      throw new ForbiddenException('Only the host can start the activity');
    }

    const { error } = await this.supabase.client
      .from('activities')
      .update({ started_at: new Date().toISOString() })
      .eq('id', activityId)
      .is('started_at', null); // first call wins; later ones change nothing

    if (error) throw new BadRequestException(error.message);
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
   * The member list, read from the database every time.
   *
   * Membership is durable and lives here; who currently has a socket open is
   * separate and ephemeral. Keeping the two apart is why a disconnect cannot
   * lose anyone from a team.
   */
  async listMembers(activityId: string): Promise<ActivityMember[]> {
    const { data, error } = await this.supabase.client
      .from('activity_members')
      .select('student_id, is_host, current_step, students(full_name)')
      .eq('activity_id', activityId)
      .eq('is_active', true)
      .order('joined_at', { ascending: true });

    if (error) throw new BadRequestException(error.message);

    return ((data ?? []) as unknown as MemberRow[]).map((row) => ({
      studentUuid: row.student_id,
      fullName: row.students?.full_name ?? 'Student',
      isHost: row.is_host,
      currentStep: row.current_step,
    }));
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

  /** A returning member: mark them active without touching their role. */
  private async reactivateMember(
    activityId: string,
    studentUuid: string,
  ): Promise<void> {
    const { error } = await this.supabase.client
      .from('activity_members')
      .update({ is_active: true, last_seen_at: new Date().toISOString() })
      .eq('activity_id', activityId)
      .eq('student_id', studentUuid);

    if (error) throw new BadRequestException(error.message);
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
