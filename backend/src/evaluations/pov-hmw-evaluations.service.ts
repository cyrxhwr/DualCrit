import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ActivitiesService } from '../activities/activities.service';
import { PovHmwService } from '../pov-hmw/pov-hmw.service';
import { LlmService } from '../llm/llm.service';
import type { StoredEvaluation } from './evaluations.service';

/** One rubric line. Same shape for POV and HMW, so one renderer serves both. */
export interface Criterion {
  standard: string;
  reason: string;
  score: number;
}

/** A statement or question with its rubric scores. */
export interface ScoredItem {
  text: string;
  /** True for the POV or HMW questions the team voted for. */
  isSelected: boolean;
  criteria: Criterion[];
}

export interface ScoredSet {
  items: ScoredItem[];
}

/** What the model returns, before it is paired back up with the text. */
interface ModelReply {
  statements?: { index: number; criteria: Criterion[] }[];
  questions?: { index: number; criteria: Criterion[] }[];
}

interface ContributionRow {
  id: string;
  student_id: string;
  content: { question?: string; statement?: string };
  is_selected: boolean;
  order_index: number;
}

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class PovHmwEvaluationsService {
  private readonly logger = new Logger(PovHmwEvaluationsService.name);

  /** Shares one in-flight call across the members who arrive together. */
  private readonly inFlight = new Map<
    string,
    Promise<{ evaluation: StoredEvaluation | null }>
  >();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly activities: ActivitiesService,
    private readonly povHmw: PovHmwService,
    private readonly llm: LlmService,
  ) {}

  // ------------------------------------------------------------------ POV

  /**
   * Every member's POV statement, scored in one pass.
   *
   * Deliberately not just the winner: seeing how your own statement scored
   * against the one the team chose is the point of the step. One call, one
   * team row — a four-person team pays for one evaluation, as with the
   * interview question.
   */
  async getOrCreatePovFeedback(
    activityId: string,
    studentUuid: string,
  ): Promise<{ evaluation: StoredEvaluation | null }> {
    await this.activities.assertMember(activityId, studentUuid);

    const existing = await this.findTeam(activityId, 'pov_feedback');
    if (existing) return { evaluation: existing };

    const key = `${activityId}:pov_feedback`;
    const running = this.inFlight.get(key);
    if (running) return running;

    const work = this.generatePovFeedback(activityId, studentUuid).finally(() =>
      this.inFlight.delete(key),
    );
    this.inFlight.set(key, work);
    return work;
  }

  private async generatePovFeedback(
    activityId: string,
    studentUuid: string,
  ): Promise<{ evaluation: StoredEvaluation | null }> {
    if (!this.llm.available) return { evaluation: null };

    const rows = await this.contributions(activityId, 'pov_statement');
    if (rows.length === 0) {
      throw new BadRequestException('Nobody has submitted a POV statement yet');
    }

    const { needs, insights } = await this.povHmw.get(activityId, studentUuid);
    const texts = rows.map((r) => r.content.statement ?? '');

    const input = [
      '## Needs',
      ...needs.map((n, i) => `${i + 1}. ${n}`),
      '',
      '## Insights',
      ...insights.map((n, i) => `${i + 1}. ${n}`),
      '',
      '## POV statements to evaluate',
      ...texts.map((t, i) => `${i + 1}. ${t}`),
    ].join('\n');

    const { parsed, raw, model } = await this.llm.askForJson<ModelReply>(
      'pov-feedback.txt',
      input,
    );

    const scored = this.pair(texts, rows, parsed.statements ?? []);
    return this.store(activityId, 'pov_feedback', 'team', null, {
      input: { needs, insights, statements: texts },
      raw,
      model,
      scored,
    });
  }

  // ------------------------------------------------------------------ HMW

  /**
   * Two evaluations on this screen: the student's own three questions, and
   * the three the team voted for. The old system showed both side by side,
   * and the comparison is the lesson.
   */
  async getOrCreateHmwFeedback(
    activityId: string,
    studentUuid: string,
  ): Promise<{ mine: StoredEvaluation | null; team: StoredEvaluation | null }> {
    await this.activities.assertMember(activityId, studentUuid);

    const [mine, team] = await Promise.all([
      this.hmwForStudent(activityId, studentUuid),
      this.hmwForTeam(activityId, studentUuid),
    ]);
    return { mine, team };
  }

  private async hmwForStudent(
    activityId: string,
    studentUuid: string,
  ): Promise<StoredEvaluation | null> {
    const existing = await this.findUser(
      activityId,
      studentUuid,
      'hmw_feedback',
    );
    if (existing) return existing;

    const key = `${activityId}:${studentUuid}:hmw_feedback`;
    const running = this.inFlight.get(key);
    if (running) return (await running).evaluation;

    const work = (async () => {
      const rows = (
        await this.contributions(activityId, 'hmw_question')
      ).filter((r) => r.student_id === studentUuid);
      if (rows.length === 0 || !this.llm.available) return { evaluation: null };
      return this.scoreHmw(activityId, studentUuid, rows, 'user', studentUuid);
    })().finally(() => this.inFlight.delete(key));

    this.inFlight.set(key, work);
    return (await work).evaluation;
  }

  private async hmwForTeam(
    activityId: string,
    studentUuid: string,
  ): Promise<StoredEvaluation | null> {
    const existing = await this.findTeam(activityId, 'hmw_feedback');
    if (existing) return existing;

    const key = `${activityId}:team:hmw_feedback`;
    const running = this.inFlight.get(key);
    if (running) return (await running).evaluation;

    const work = (async () => {
      const rows = (
        await this.contributions(activityId, 'hmw_question')
      ).filter((r) => r.is_selected);
      if (rows.length === 0 || !this.llm.available) return { evaluation: null };
      return this.scoreHmw(activityId, studentUuid, rows, 'team', null);
    })().finally(() => this.inFlight.delete(key));

    this.inFlight.set(key, work);
    return (await work).evaluation;
  }

  private async scoreHmw(
    activityId: string,
    studentUuid: string,
    rows: ContributionRow[],
    scope: 'team' | 'user',
    storeFor: string | null,
  ): Promise<{ evaluation: StoredEvaluation | null }> {
    const { needs, insights } = await this.povHmw.get(activityId, studentUuid);
    const pov = await this.selectedPov(activityId);
    const texts = rows.map((r) => r.content.question ?? '');

    const input = [
      '## Point of view',
      pov ?? '(not recorded)',
      '',
      '## Needs',
      ...needs.map((n, i) => `${i + 1}. ${n}`),
      '',
      '## Insights',
      ...insights.map((n, i) => `${i + 1}. ${n}`),
      '',
      '## HMW questions to evaluate',
      ...texts.map((t, i) => `${i + 1}. ${t}`),
    ].join('\n');

    const { parsed, raw, model } = await this.llm.askForJson<ModelReply>(
      'hmw-feedback.txt',
      input,
    );

    const scored = this.pair(texts, rows, parsed.questions ?? []);
    return this.store(activityId, 'hmw_feedback', scope, storeFor, {
      input: { pov, needs, insights, questions: texts },
      raw,
      model,
      scored,
    });
  }

  // -------------------------------------------------------------- plumbing

  /**
   * Pair the model's answers back to the text by index.
   *
   * The model is asked to keep the order and echo the index, but an answer it
   * omits must not shift every later score onto the wrong statement — so this
   * matches on the stated index and drops anything unmatched.
   */
  private pair(
    texts: string[],
    rows: ContributionRow[],
    replies: { index: number; criteria: Criterion[] }[],
  ): ScoredSet {
    const byIndex = new Map(replies.map((r) => [Number(r.index), r.criteria]));
    const items: ScoredItem[] = [];

    texts.forEach((text, i) => {
      const criteria = byIndex.get(i + 1);
      if (!Array.isArray(criteria)) {
        this.logger.warn(`No evaluation returned for item ${i + 1}`);
        return;
      }
      items.push({ text, isSelected: rows[i]?.is_selected ?? false, criteria });
    });

    return { items };
  }

  private async store(
    activityId: string,
    evaluationType: 'pov_feedback' | 'hmw_feedback',
    scope: 'team' | 'user',
    studentId: string | null,
    payload: { input: unknown; raw: unknown; model: string; scored: ScoredSet },
  ): Promise<{ evaluation: StoredEvaluation | null }> {
    const { error } = await this.supabase.client.from('ai_evaluations').insert({
      activity_id: activityId,
      student_id: studentId,
      scope,
      evaluation_type: evaluationType,
      model: payload.model,
      input_data: payload.input,
      ai_response: payload.raw,
      processed_scores: payload.scored,
      feedback_summary: payload.scored.items[0]?.criteria[0]?.reason ?? null,
    });

    if (error && error.code !== UNIQUE_VIOLATION) {
      throw new BadRequestException(error.message);
    }
    // A unique violation means someone else's call landed first; read theirs.

    const stored =
      scope === 'team'
        ? await this.findTeam(activityId, evaluationType)
        : await this.findUser(activityId, studentId!, evaluationType);

    return { evaluation: stored };
  }

  private async contributions(
    activityId: string,
    type: 'pov_statement' | 'hmw_question',
  ): Promise<ContributionRow[]> {
    const { data, error } = await this.supabase.client
      .from('contributions')
      .select('id, student_id, content, is_selected, order_index')
      .eq('activity_id', activityId)
      .eq('type', type)
      .order('order_index', { ascending: true })
      .order('id', { ascending: true });

    if (error) throw new BadRequestException(error.message);
    return (data ?? []) as ContributionRow[];
  }

  private async selectedPov(activityId: string): Promise<string | null> {
    const { data, error } = await this.supabase.client
      .from('activities')
      .select('selected_pov_content')
      .eq('id', activityId)
      .single<{ selected_pov_content: string | null }>();

    if (error) throw new BadRequestException(error.message);
    return data.selected_pov_content;
  }

  private async findTeam(
    activityId: string,
    evaluationType: string,
  ): Promise<StoredEvaluation | null> {
    return this.find(activityId, evaluationType, 'team', null);
  }

  private async findUser(
    activityId: string,
    studentUuid: string,
    evaluationType: string,
  ): Promise<StoredEvaluation | null> {
    return this.find(activityId, evaluationType, 'user', studentUuid);
  }

  private async find(
    activityId: string,
    evaluationType: string,
    scope: 'team' | 'user',
    studentUuid: string | null,
  ): Promise<StoredEvaluation | null> {
    let query = this.supabase.client
      .from('ai_evaluations')
      .select('id, scope, evaluation_type, processed_scores, model, created_at')
      .eq('activity_id', activityId)
      .eq('evaluation_type', evaluationType)
      .eq('scope', scope);

    query = studentUuid
      ? query.eq('student_id', studentUuid)
      : query.is('student_id', null);

    const { data, error } = await query.maybeSingle<{
      id: string;
      scope: 'team' | 'user';
      evaluation_type: string;
      processed_scores: ScoredSet;
      model: string | null;
      created_at: string;
    }>();

    if (error) throw new BadRequestException(error.message);
    if (!data) return null;

    return {
      id: data.id,
      scope: data.scope,
      evaluationType: data.evaluation_type,
      feedback: data.processed_scores as never,
      model: data.model,
      createdAt: data.created_at,
    };
  }
}
