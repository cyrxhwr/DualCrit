import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ActivitiesService } from '../activities/activities.service';
import type {
  Criterion,
  FeedbackItem,
} from '../evaluations/evaluations.service';

interface Message {
  role: 'student' | 'persona';
  text: string;
}

export interface SessionSummary {
  activityName: string;
  scenarioTag: string | null;
  myQuestion: string | null;
  teamQuestion: string | null;
  questionFeedback: FeedbackItem[];
  transcript: Message[];
  criteria: Criterion[];
  questionCount: number;
  summaryText: string;
  /** False when the summary could be shown but not stored. */
  saved: boolean;
}

@Injectable()
export class SummaryService {
  private readonly logger = new Logger(SummaryService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly activities: ActivitiesService,
  ) {}

  /**
   * Everything this student produced, assembled from stored rows.
   *
   * No model call: every part of this was written down when it happened, so
   * the summary is a read rather than a regeneration. That also means it
   * cannot drift from what the student actually saw earlier.
   */
  async build(
    activityId: string,
    studentUuid: string,
  ): Promise<SessionSummary> {
    await this.activities.assertMember(activityId, studentUuid);

    const [activity, myContribution, transcript, evaluations] =
      await Promise.all([
        this.loadActivity(activityId),
        this.loadMyQuestion(activityId, studentUuid),
        this.loadTranscript(activityId, studentUuid),
        this.loadEvaluations(activityId, studentUuid),
      ]);

    const questionCount = transcript.filter((m) => m.role === 'student').length;

    const summary: Omit<SessionSummary, 'summaryText' | 'saved'> = {
      activityName: activity.name,
      scenarioTag: activity.selected_scenario_tag,
      myQuestion: myContribution,
      teamQuestion: activity.selected_question_content,
      questionFeedback: evaluations.questionFeedback,
      transcript,
      criteria: evaluations.criteria,
      questionCount,
    };

    const summaryText = this.render(summary);
    const saved = await this.store(
      activityId,
      studentUuid,
      summaryText,
      questionCount,
    );

    return { ...summary, summaryText, saved };
  }

  /**
   * Persist the rendered summary.
   *
   * Reports failure rather than hiding it. The previous system wrapped this
   * save in a catch that only logged a console warning, so a summary could
   * silently fail to store and nobody would know until the data was missing
   * at analysis time.
   */
  private async store(
    activityId: string,
    studentUuid: string,
    summaryText: string,
    questionCount: number,
  ): Promise<boolean> {
    const { error } = await this.supabase.client
      .from('interview_summaries')
      .upsert(
        {
          activity_id: activityId,
          student_id: studentUuid,
          summary_text: summaryText,
          summary_format: 'markdown',
          question_count: questionCount,
        },
        { onConflict: 'activity_id,student_id' },
      );

    if (error) {
      this.logger.error(
        `Could not store summary for ${studentUuid} in ${activityId}: ${error.message}`,
      );
      return false;
    }
    return true;
  }

  /** Markdown, so the stored text stays readable wherever it is exported. */
  private render(s: Omit<SessionSummary, 'summaryText' | 'saved'>): string {
    const lines: string[] = [`# ${s.activityName}`, ''];

    if (s.myQuestion) {
      lines.push('## The question I wrote', '', s.myQuestion, '');
    }

    if (s.teamQuestion) {
      lines.push('## The question my team chose', '', s.teamQuestion, '');
    }

    if (s.questionFeedback.length > 0) {
      lines.push('## Feedback on the team question', '');
      for (const item of s.questionFeedback) {
        lines.push(`- **${item.mistake}** — ${item.explanation}`);
      }
      lines.push('');
    }

    if (s.transcript.length > 0) {
      lines.push('## My interview', '');
      for (const message of s.transcript) {
        lines.push(
          `**${message.role === 'student' ? 'Me' : 'Persona'}:** ${message.text}`,
          '',
        );
      }
    }

    if (s.criteria.length > 0) {
      lines.push('## Feedback on my interview', '');
      for (const criterion of s.criteria) {
        lines.push(
          `### ${criterion.standard} — ${criterion.score}/5`,
          '',
          criterion.response,
          '',
        );
      }
    }

    return lines.join('\n').trim();
  }

  private async loadActivity(activityId: string) {
    const { data, error } = await this.supabase.client
      .from('activities')
      .select('name, selected_question_content, selected_scenario_tag')
      .eq('id', activityId)
      .single<{
        name: string;
        selected_question_content: string | null;
        selected_scenario_tag: string | null;
      }>();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  private async loadMyQuestion(
    activityId: string,
    studentUuid: string,
  ): Promise<string | null> {
    const { data, error } = await this.supabase.client
      .from('contributions')
      .select('content')
      .eq('activity_id', activityId)
      .eq('student_id', studentUuid)
      .eq('type', 'interview_question')
      .maybeSingle<{ content: { question?: string } }>();

    if (error) throw new BadRequestException(error.message);
    return data?.content?.question ?? null;
  }

  /**
   * The most recent attempt.
   *
   * Ordering explicitly by attempt is what the previous system lacked: it read
   * with .single(), which errors on more than one row, and the error was never
   * checked - so a student who re-ran their interview got a summary with no
   * transcript at all.
   */
  private async loadTranscript(
    activityId: string,
    studentUuid: string,
  ): Promise<Message[]> {
    const { data, error } = await this.supabase.client
      .from('interview_transcripts')
      .select('messages')
      .eq('activity_id', activityId)
      .eq('student_id', studentUuid)
      .order('attempt', { ascending: false })
      .limit(1);

    if (error) throw new BadRequestException(error.message);
    return (data?.[0] as { messages: Message[] } | undefined)?.messages ?? [];
  }

  private async loadEvaluations(
    activityId: string,
    studentUuid: string,
  ): Promise<{ questionFeedback: FeedbackItem[]; criteria: Criterion[] }> {
    const { data, error } = await this.supabase.client
      .from('ai_evaluations')
      .select('evaluation_type, scope, student_id, processed_scores')
      .eq('activity_id', activityId)
      .in('evaluation_type', ['pre_question_eval', 'post_interview_eval']);

    if (error) throw new BadRequestException(error.message);

    const rows = (data ?? []) as {
      evaluation_type: string;
      scope: 'team' | 'user';
      student_id: string | null;
      processed_scores: { feedback?: FeedbackItem[]; criteria?: Criterion[] };
    }[];

    // The question evaluation is the team's, so every member shows the same
    // one. The interview evaluation is personal, so it is matched on this
    // student and never falls back to somebody else's.
    const team = rows.find(
      (r) => r.evaluation_type === 'pre_question_eval' && r.scope === 'team',
    );
    const mine = rows.find(
      (r) =>
        r.evaluation_type === 'post_interview_eval' &&
        r.scope === 'user' &&
        r.student_id === studentUuid,
    );

    return {
      questionFeedback: team?.processed_scores.feedback ?? [],
      criteria: mine?.processed_scores.criteria ?? [],
    };
  }
}
