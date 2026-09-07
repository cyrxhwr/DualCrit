import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ActivitiesService } from '../activities/activities.service';
import type {
  Criterion,
  FeedbackItem,
} from '../evaluations/evaluations.service';
import type {
  ScoredItem,
  ScoredSet,
} from '../evaluations/pov-hmw-evaluations.service';

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

/**
 * The POV & HMW equivalent.
 *
 * Both halves of each step are here: what this student wrote and what the team
 * settled on, so the summary shows the comparison the workflow is built around.
 */
/**
 * A scored entry with the reader's own authorship attached.
 *
 * The stored evaluations carry no authorship — that is what keeps voting
 * anonymous — so this is worked out per reader at read time and never written
 * back.
 */
export interface SummaryScoredItem extends ScoredItem {
  isMine: boolean;
}

export interface PovHmwSummary {
  activityName: string;
  needs: string[];
  insights: string[];
  myPov: string | null;
  teamPov: string | null;
  /** Every member's statement, scored together. */
  povFeedback: SummaryScoredItem[];
  myHmw: string[];
  teamHmw: string[];
  /**
   * The team's chosen questions and the student's own, merged into one set.
   *
   * A question that is both was previously scored twice — once in the team's
   * evaluation and once in the student's — by two separate model calls that
   * could disagree about the same words. The team's scores win here, so a
   * chosen question reads the same for everyone looking at it.
   */
  hmwFeedback: SummaryScoredItem[];
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
    questionCount: number | null,
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
        if (item.nextStep?.trim()) {
          lines.push(`  - Try next: ${item.nextStep}`);
        }
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
        if (criterion.nextStep?.trim()) {
          lines.push(`**Try next:** ${criterion.nextStep}`, '');
        }
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

  // ----------------------------------------------------------- POV & HMW

  /**
   * The POV & HMW equivalent of build().
   *
   * Same principle: every part was written down when it happened, so this is a
   * read rather than a regeneration and cannot drift from what the student was
   * shown. It shares interview_summaries, keyed by (activity, student) — an
   * activity is one type or the other, so the two never collide.
   */
  async buildPovHmw(
    activityId: string,
    studentUuid: string,
  ): Promise<PovHmwSummary> {
    await this.activities.assertMember(activityId, studentUuid);

    const [activity, research, contributions, evaluations] = await Promise.all([
      this.loadPovHmwActivity(activityId),
      this.loadResearch(activityId),
      this.loadPovHmwContributions(activityId, studentUuid),
      this.loadPovHmwEvaluations(activityId, studentUuid),
    ]);

    const summary: Omit<PovHmwSummary, 'summaryText' | 'saved'> = {
      activityName: activity.name,
      needs: research.needs,
      insights: research.insights,
      myPov: contributions.myPov,
      teamPov: activity.selected_pov_content,
      povFeedback: this.markMine(evaluations.povFeedback, [
        contributions.myPov,
      ]),
      myHmw: contributions.myHmw,
      teamHmw: activity.selected_hmw_contents ?? contributions.teamHmw,
      hmwFeedback: this.mergeHmw(
        evaluations.teamHmwFeedback,
        evaluations.myHmwFeedback,
        contributions.myHmw,
      ),
    };

    const summaryText = this.renderPovHmw(summary);
    const saved = await this.store(activityId, studentUuid, summaryText, null);

    return { ...summary, summaryText, saved };
  }

  /** Attach authorship by matching the text, since the sets carry none. */
  private markMine(
    set: ScoredSet | null,
    myTexts: (string | null)[],
  ): SummaryScoredItem[] {
    const ours = myTexts.filter((t): t is string => Boolean(t));
    return (set?.items ?? []).map((item) => ({
      ...item,
      isMine: ours.includes(item.text),
    }));
  }

  /**
   * One HMW set instead of two overlapping ones.
   *
   * The team's evaluation goes in first, so the chosen questions lead and
   * their scores are the ones everyone sees; the student's own questions that
   * did not win follow. A question in both appears once.
   */
  private mergeHmw(
    team: ScoredSet | null,
    mine: ScoredSet | null,
    myTexts: string[],
  ): SummaryScoredItem[] {
    const seen = new Set<string>();
    const merged: SummaryScoredItem[] = [];

    for (const item of [...(team?.items ?? []), ...(mine?.items ?? [])]) {
      if (seen.has(item.text)) continue;
      seen.add(item.text);
      merged.push({ ...item, isMine: myTexts.includes(item.text) });
    }

    return merged;
  }

  private renderPovHmw(
    s: Omit<PovHmwSummary, 'summaryText' | 'saved'>,
  ): string {
    const lines: string[] = [`# ${s.activityName}`, ''];
    const list = (items: string[]) => items.map((t, i) => `${i + 1}. ${t}`);

    if (s.needs.length > 0) {
      lines.push("## My team's needs", '', ...list(s.needs), '');
    }
    if (s.insights.length > 0) {
      lines.push("## My team's insights", '', ...list(s.insights), '');
    }

    if (s.teamPov) {
      lines.push('## The POV statement my team chose', '', s.teamPov, '');
    }

    if (
      !this.renderScored(
        lines,
        "## Feedback on my team's POV statements",
        s.povFeedback,
      ) &&
      s.myPov
    ) {
      lines.push('## The POV statement I wrote', '', s.myPov, '');
    }

    if (
      !this.renderScored(
        lines,
        '## Feedback on the HMW questions',
        s.hmwFeedback,
      )
    ) {
      if (s.myHmw.length > 0) {
        lines.push('## The HMW questions I wrote', '', ...list(s.myHmw), '');
      }
      if (s.teamHmw.length > 0) {
        lines.push(
          '## The HMW questions my team chose',
          '',
          ...list(s.teamHmw),
          '',
        );
      }
    }

    return lines.join('\n').trim();
  }

  /**
   * One scored set as markdown.
   *
   * Returns false when there was nothing to write, which is what makes the
   * plain lists a fallback rather than a duplicate.
   */
  private renderScored(
    lines: string[],
    heading: string,
    items: SummaryScoredItem[],
  ): boolean {
    if (items.length === 0) return false;

    lines.push(heading, '');
    for (const item of items) {
      const tags = [
        item.isMine ? 'mine' : null,
        item.isSelected ? "my team's choice" : null,
      ].filter(Boolean);

      lines.push(
        `### ${item.text}${tags.length > 0 ? ` _(${tags.join(', ')})_` : ''}`,
        '',
      );
      for (const criterion of item.criteria) {
        lines.push(
          `- **${criterion.standard} — ${criterion.score}/5** — ${criterion.reason}`,
        );
        if (criterion.nextStep?.trim()) {
          lines.push(`  - Try next: ${criterion.nextStep}`);
        }
      }
      lines.push('');
    }
    return true;
  }

  private async loadPovHmwActivity(activityId: string) {
    const { data, error } = await this.supabase.client
      .from('activities')
      .select('name, selected_pov_content, selected_hmw_contents')
      .eq('id', activityId)
      .single<{
        name: string;
        selected_pov_content: string | null;
        selected_hmw_contents: string[] | null;
      }>();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  private async loadResearch(
    activityId: string,
  ): Promise<{ needs: string[]; insights: string[] }> {
    const { data, error } = await this.supabase.client
      .from('pov_hmw_data')
      .select('needs, insights')
      .eq('activity_id', activityId)
      .maybeSingle<{ needs: string[] | null; insights: string[] | null }>();

    if (error) throw new BadRequestException(error.message);
    return { needs: data?.needs ?? [], insights: data?.insights ?? [] };
  }

  private async loadPovHmwContributions(
    activityId: string,
    studentUuid: string,
  ): Promise<{ myPov: string | null; myHmw: string[]; teamHmw: string[] }> {
    const { data, error } = await this.supabase.client
      .from('contributions')
      .select('student_id, type, content, is_selected, order_index')
      .eq('activity_id', activityId)
      .in('type', ['pov_statement', 'hmw_question'])
      .order('order_index', { ascending: true })
      .order('id', { ascending: true });

    if (error) throw new BadRequestException(error.message);

    const rows = (data ?? []) as {
      student_id: string;
      type: string;
      content: { statement?: string; question?: string };
      is_selected: boolean;
    }[];

    const hmw = rows.filter((r) => r.type === 'hmw_question');

    return {
      myPov:
        rows.find(
          (r) => r.type === 'pov_statement' && r.student_id === studentUuid,
        )?.content.statement ?? null,
      myHmw: hmw
        .filter((r) => r.student_id === studentUuid)
        .map((r) => r.content.question ?? ''),
      teamHmw: hmw
        .filter((r) => r.is_selected)
        .map((r) => r.content.question ?? ''),
    };
  }

  private async loadPovHmwEvaluations(
    activityId: string,
    studentUuid: string,
  ): Promise<{
    povFeedback: ScoredSet | null;
    myHmwFeedback: ScoredSet | null;
    teamHmwFeedback: ScoredSet | null;
  }> {
    const { data, error } = await this.supabase.client
      .from('ai_evaluations')
      .select('evaluation_type, scope, student_id, processed_scores')
      .eq('activity_id', activityId)
      .in('evaluation_type', ['pov_feedback', 'hmw_feedback']);

    if (error) throw new BadRequestException(error.message);

    const rows = (data ?? []) as {
      evaluation_type: string;
      scope: 'team' | 'user';
      student_id: string | null;
      processed_scores: ScoredSet;
    }[];

    const pick = (type: string, scope: 'team' | 'user', student?: string) =>
      rows.find(
        (r) =>
          r.evaluation_type === type &&
          r.scope === scope &&
          (scope === 'team' || r.student_id === student),
      )?.processed_scores ?? null;

    // The POV evaluation is the team's single pass over every statement; the
    // HMW step produces two, and the personal one is matched on this student
    // so it never falls back to somebody else's.
    return {
      povFeedback: pick('pov_feedback', 'team'),
      myHmwFeedback: pick('hmw_feedback', 'user', studentUuid),
      teamHmwFeedback: pick('hmw_feedback', 'team'),
    };
  }
}
