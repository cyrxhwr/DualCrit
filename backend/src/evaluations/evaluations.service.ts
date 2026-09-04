import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ActivitiesService } from '../activities/activities.service';
import { LlmService } from '../llm/llm.service';

/** One entry per rubric violation, or a single "None" entry when sound. */
export interface FeedbackItem {
  mistake: string;
  explanation: string;
}

export interface QuestionFeedback {
  feedback: FeedbackItem[];
}

export interface StoredEvaluation {
  id: string;
  scope: 'team' | 'user';
  evaluationType: string;
  feedback: QuestionFeedback;
  model: string | null;
  createdAt: string;
}

interface EvaluationRow {
  id: string;
  scope: 'team' | 'user';
  evaluation_type: string;
  processed_scores: QuestionFeedback;
  model: string | null;
  created_at: string;
}

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class EvaluationsService {
  private readonly logger = new Logger(EvaluationsService.name);

  /** activity+type -> the call already in progress on this instance. */
  private readonly inFlight = new Map<
    string,
    Promise<{ evaluation: StoredEvaluation | null; generating: boolean }>
  >();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly activities: ActivitiesService,
    private readonly llm: LlmService,
  ) {}

  /**
   * The team's feedback on the question they voted for.
   *
   * Generated once per activity, not once per student. In the previous system
   * every member triggered their own call for the same question at
   * temperature 0, so a four-person team paid four times the tokens and four
   * times the wait for what was effectively one answer — and each member then
   * saw a slightly different result for a question the team shared.
   *
   * Whoever asks first pays for it; everyone else reads the stored row. Two
   * students asking at the same moment is settled by the database: the unique
   * index permits one team evaluation of each type per activity, so the loser
   * gets a unique violation and reads the winner's.
   */
  async getOrCreateQuestionFeedback(
    activityId: string,
    studentUuid: string,
  ): Promise<{ evaluation: StoredEvaluation | null; generating: boolean }> {
    await this.activities.assertMember(activityId, studentUuid);

    const existing = await this.findTeamEvaluation(
      activityId,
      'pre_question_eval',
    );
    if (existing) return { evaluation: existing, generating: false };

    // The unique index stops a second row being written, but it cannot stop a
    // second request being sent to the model — every member arriving at this
    // screen together would each pay for a call and then throw all but one
    // away. Share the in-flight promise so a team costs one call.
    const key = `${activityId}:pre_question_eval`;
    const running = this.inFlight.get(key);
    if (running) return running;

    const work = this.generateQuestionFeedback(activityId).finally(() =>
      this.inFlight.delete(key),
    );
    this.inFlight.set(key, work);
    return work;
  }

  private async generateQuestionFeedback(
    activityId: string,
  ): Promise<{ evaluation: StoredEvaluation | null; generating: boolean }> {

    const activity = await this.loadActivityForPrompt(activityId);
    if (!activity.selected_question_content) {
      throw new BadRequestException('Your team has not chosen a question yet');
    }

    if (!this.llm.available) {
      return { evaluation: null, generating: false };
    }

    const { parsed, raw, model } = await this.llm.askForJson<QuestionFeedback>(
      'question-feedback.txt',
      [
        `Persona: ${activity.selected_scenario_tag ?? 'unknown'}`,
        `Interview question: ${activity.selected_question_content}`,
      ].join('\n'),
    );

    const { error } = await this.supabase.client.from('ai_evaluations').insert({
      activity_id: activityId,
      student_id: null,
      scope: 'team',
      evaluation_type: 'pre_question_eval',
      model,
      input_data: {
        question: activity.selected_question_content,
        scenarioTag: activity.selected_scenario_tag,
      },
      ai_response: raw,
      processed_scores: parsed,
      feedback_summary: parsed.feedback?.[0]?.explanation ?? null,
    });

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        // Someone else got there first while this call was with the model.
        const winner = await this.findTeamEvaluation(
          activityId,
          'pre_question_eval',
        );
        if (winner) return { evaluation: winner, generating: false };
      }
      throw new BadRequestException(error.message);
    }

    this.logger.log(`Generated team question feedback for ${activityId}`);

    const stored = await this.findTeamEvaluation(
      activityId,
      'pre_question_eval',
    );
    return { evaluation: stored, generating: false };
  }

  /** Read without generating — used when a member arrives after the fact. */
  async readQuestionFeedback(
    activityId: string,
    studentUuid: string,
  ): Promise<{ evaluation: StoredEvaluation | null }> {
    await this.activities.assertMember(activityId, studentUuid);
    return {
      evaluation: await this.findTeamEvaluation(
        activityId,
        'pre_question_eval',
      ),
    };
  }

  private async findTeamEvaluation(
    activityId: string,
    evaluationType: string,
  ): Promise<StoredEvaluation | null> {
    const { data, error } = await this.supabase.client
      .from('ai_evaluations')
      .select('id, scope, evaluation_type, processed_scores, model, created_at')
      .eq('activity_id', activityId)
      .eq('evaluation_type', evaluationType)
      .eq('scope', 'team')
      .maybeSingle<EvaluationRow>();

    if (error) throw new BadRequestException(error.message);
    if (!data) return null;

    return {
      id: data.id,
      scope: data.scope,
      evaluationType: data.evaluation_type,
      feedback: data.processed_scores,
      model: data.model,
      createdAt: data.created_at,
    };
  }

  private async loadActivityForPrompt(activityId: string): Promise<{
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
