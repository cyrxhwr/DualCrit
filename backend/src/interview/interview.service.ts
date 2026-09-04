import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ActivitiesService } from '../activities/activities.service';
import { LlmService } from '../llm/llm.service';

export interface Message {
  role: 'student' | 'persona';
  text: string;
  at: string;
}

export interface InterviewState {
  attempt: number;
  messages: Message[];
  openingQuestion: string | null;
  scenarioTag: string | null;
  completed: boolean;
  turnsLeft: number;
}

/**
 * A soft cap on questions per interview. Enough for a real conversation, and
 * it bounds what a single student can spend if they keep going.
 */
export const MAX_STUDENT_TURNS = 20;

interface TranscriptRow {
  id: string;
  attempt: number;
  messages: Message[];
}

@Injectable()
export class InterviewService {
  private readonly logger = new Logger(InterviewService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly activities: ActivitiesService,
    private readonly llm: LlmService,
  ) {}

  async getState(
    activityId: string,
    studentUuid: string,
  ): Promise<InterviewState> {
    await this.activities.assertMember(activityId, studentUuid);

    const [transcript, activity, completed] = await Promise.all([
      this.latestTranscript(activityId, studentUuid),
      this.loadActivity(activityId),
      this.isComplete(activityId, studentUuid),
    ]);

    const messages = transcript?.messages ?? [];

    return {
      attempt: transcript?.attempt ?? 1,
      messages,
      openingQuestion: activity.selected_question_content,
      scenarioTag: activity.selected_scenario_tag,
      completed,
      turnsLeft: MAX_STUDENT_TURNS - this.studentTurns(messages),
    };
  }

  /**
   * Ask the persona something and store both sides of the exchange.
   *
   * The whole conversation is replayed to the model each turn, read from this
   * student's own transcript row. The previous system kept a per-user agent in
   * memory and, when a follow-up arrived without matching history, scanned
   * *other students' agents* for one with the same persona and reused it — so
   * a reconnecting student could inherit a classmate's interview. Holding no
   * conversation state in the process makes that impossible, and it survives a
   * restart for free.
   */
  async ask(
    activityId: string,
    studentUuid: string,
    text: string,
  ): Promise<InterviewState> {
    await this.activities.assertMember(activityId, studentUuid);

    const activity = await this.loadActivity(activityId);
    if (!activity.selected_scenario_tag) {
      throw new BadRequestException('Your team has not chosen a scenario yet');
    }

    const transcript = await this.latestTranscript(activityId, studentUuid);
    const messages = transcript?.messages ?? [];

    if (this.studentTurns(messages) >= MAX_STUDENT_TURNS) {
      throw new BadRequestException(
        `An interview is limited to ${MAX_STUDENT_TURNS} questions`,
      );
    }

    const question = text.trim();
    const withQuestion: Message[] = [
      ...messages,
      { role: 'student', text: question, at: new Date().toISOString() },
    ];

    const answer = await this.llm.askPersona(
      activity.selected_scenario_tag,
      withQuestion.map((m) => ({
        role: m.role === 'student' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      })),
    );

    const withAnswer: Message[] = [
      ...withQuestion,
      { role: 'persona', text: answer, at: new Date().toISOString() },
    ];

    await this.saveTranscript(
      activityId,
      studentUuid,
      transcript?.attempt ?? 1,
      withAnswer,
      activity.selected_scenario_tag,
    );

    return {
      attempt: transcript?.attempt ?? 1,
      messages: withAnswer,
      openingQuestion: activity.selected_question_content,
      scenarioTag: activity.selected_scenario_tag,
      completed: false,
      turnsLeft: MAX_STUDENT_TURNS - this.studentTurns(withAnswer),
    };
  }

  /** Marks this student done, which the team's progress reads from. */
  async complete(activityId: string, studentUuid: string): Promise<void> {
    await this.activities.assertMember(activityId, studentUuid);

    const transcript = await this.latestTranscript(activityId, studentUuid);
    if (!transcript || transcript.messages.length === 0) {
      throw new BadRequestException('There is no interview to finish yet');
    }

    const { error } = await this.supabase.client
      .from('interview_completions')
      .upsert(
        { activity_id: activityId, student_id: studentUuid },
        { onConflict: 'activity_id,student_id' },
      );

    if (error) throw new BadRequestException(error.message);
  }

  /** How many members have finished — used to gate the steps that follow. */
  async progress(
    activityId: string,
    studentUuid: string,
  ): Promise<{ completed: number; total: number }> {
    await this.activities.assertMember(activityId, studentUuid);

    const [members, { count, error }] = await Promise.all([
      this.activities.listMembers(activityId),
      this.supabase.client
        .from('interview_completions')
        .select('student_id', { count: 'exact', head: true })
        .eq('activity_id', activityId),
    ]);

    if (error) throw new BadRequestException(error.message);
    return { completed: count ?? 0, total: members.length };
  }

  private studentTurns(messages: Message[]): number {
    return messages.filter((m) => m.role === 'student').length;
  }

  private async latestTranscript(
    activityId: string,
    studentUuid: string,
  ): Promise<TranscriptRow | null> {
    const { data, error } = await this.supabase.client
      .from('interview_transcripts')
      .select('id, attempt, messages')
      .eq('activity_id', activityId)
      .eq('student_id', studentUuid)
      .order('attempt', { ascending: false })
      .limit(1);

    if (error) throw new BadRequestException(error.message);
    return (data?.[0] as TranscriptRow | undefined) ?? null;
  }

  private async saveTranscript(
    activityId: string,
    studentUuid: string,
    attempt: number,
    messages: Message[],
    scenarioTag: string,
  ): Promise<void> {
    const { error } = await this.supabase.client
      .from('interview_transcripts')
      .upsert(
        {
          activity_id: activityId,
          student_id: studentUuid,
          attempt,
          messages,
          scenario_tag: scenarioTag,
        },
        { onConflict: 'activity_id,student_id,attempt' },
      );

    if (error) throw new BadRequestException(error.message);
  }

  private async isComplete(
    activityId: string,
    studentUuid: string,
  ): Promise<boolean> {
    const { data, error } = await this.supabase.client
      .from('interview_completions')
      .select('student_id')
      .eq('activity_id', activityId)
      .eq('student_id', studentUuid)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    return data !== null;
  }

  private async loadActivity(activityId: string): Promise<{
    selected_question_content: string | null;
    selected_scenario_tag: string | null;
  }> {
    const { data, error } = await this.supabase.client
      .from('activities')
      .select('selected_question_content, selected_scenario_tag')
      .eq('id', activityId)
      .single<{
        selected_question_content: string | null;
        selected_scenario_tag: string | null;
      }>();

    if (error) throw new BadRequestException(error.message);
    return data;
  }
}
