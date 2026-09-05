import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import OpenAI from 'openai';

/**
 * Matches the model the previous system used for evaluations, so feedback is
 * comparable with anything collected before. Override with OPENAI_MODEL —
 * gpt-4o-mini is far cheaper if exact comparability stops mattering.
 */
export const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o';

/**
 * Fixed so repeated evaluations of the same transcript are as close to
 * reproducible as the API allows. It is best-effort, not a guarantee — the
 * stored completion carries `system_fingerprint`, which changes when the
 * backend does, so a run can be told apart from an earlier one.
 */
const SEED = 20260905;

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly client: OpenAI | null;
  private readonly prompts = new Map<string, string>();

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    this.client = apiKey ? new OpenAI({ apiKey }) : null;

    if (!this.client) {
      this.logger.warn(
        'OPENAI_API_KEY is not set — AI feedback will report as unavailable rather than failing mid-request.',
      );
    }
  }

  get available(): boolean {
    return this.client !== null;
  }

  /**
   * The facts about a persona, without the acting instructions.
   *
   * The evaluators need to know who the student is interviewing — several
   * rubric items ("Lacks User Relevance", "Question Relevance") cannot be
   * judged without it. Taking it from the persona file rather than a second
   * copy keeps one source of truth, so the graders and the interviewee can
   * never describe different people.
   */
  personaBrief(scenarioTag: string): string {
    const full = this.prompt(`persona${scenarioTag}.txt`);
    const [brief] = full.split('###Behavior Guidelines');
    return brief.trim();
  }

  /**
   * Prompts are read once and cached.
   *
   * `__dirname` resolves inside dist because nest-cli copies *.txt into the
   * build output. The previous system resolved against process.cwd()/src,
   * which only worked because the deployed tree happened to keep its sources
   * next to the build — a slimmer image would have broken every LLM call at
   * first use rather than at boot.
   */
  private prompt(name: string): string {
    const cached = this.prompts.get(name);
    if (cached !== undefined) return cached;

    const contents = readFileSync(join(__dirname, 'prompts', name), 'utf-8');
    this.prompts.set(name, contents);
    return contents;
  }

  /**
   * Reply in character as one of the four personas.
   *
   * The full conversation is passed in by the caller, who reads it from that
   * student's own transcript. This service keeps no conversation state, so
   * there is nothing for one student's interview to leak into another's.
   */
  async askPersona(
    scenarioTag: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    model = DEFAULT_MODEL,
  ): Promise<string> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'The AI interviewee is not configured on this server',
      );
    }

    const completion = await this.client.chat.completions.create({
      model,
      // Matches the previous system's persona settings: a little warmth for
      // character, and short answers so students have to probe.
      temperature: 0.3,
      max_tokens: 300,
      seed: SEED,
      messages: [
        { role: 'system', content: this.prompt(`persona${scenarioTag}.txt`) },
        ...history,
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new ServiceUnavailableException('The persona returned nothing');
    }
    return content;
  }

  /**
   * Ask for JSON and parse it.
   *
   * Uses the model's JSON mode, so the reply is valid JSON by construction.
   * The previous system asked for JSON in prose and then repaired the result
   * with a regex that quoted every `word:` it found — which corrupted any
   * answer containing a colon.
   */
  async askForJson<T>(
    promptName: string,
    input: string,
    model = DEFAULT_MODEL,
  ): Promise<{ parsed: T; raw: unknown; model: string }> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'AI feedback is not configured on this server',
      );
    }

    const completion = await this.client.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 2000,
      seed: SEED,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: this.prompt(promptName) },
        { role: 'user', content: input },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new ServiceUnavailableException('The model returned nothing');
    }

    return {
      parsed: JSON.parse(content) as T,
      raw: completion,
      model,
    };
  }

  /**
   * Ask the same question `samples` times and return every answer.
   *
   * With `samples` above 1 this is self-consistency (Wang et al., 2022): the
   * caller aggregates rather than trusting one answer. See EVAL_SAMPLES in
   * consensus.ts for what that buys and what the default gives up.
   *
   * The seed is sent only for a single sample, where reproducibility is the
   * point. Seeding several would push them towards the same answer, which is
   * exactly what an aggregate needs them not to do.
   */
  async askForJsonSamples<T>(
    promptName: string,
    input: string,
    samples: number,
    model = DEFAULT_MODEL,
  ): Promise<{ parsed: T[]; raw: unknown[]; model: string }> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'AI feedback is not configured on this server',
      );
    }

    const client = this.client;
    const system = this.prompt(promptName);
    const count = Math.max(1, samples);

    // allSettled, not all: more samples means more chance of meeting a rate
    // limit, and two good samples still beat abandoning the evaluation.
    const settled = await Promise.allSettled(
      Array.from({ length: count }, () =>
        client.chat.completions.create({
          model,
          temperature: 0,
          max_tokens: 2000,
          ...(count === 1 ? { seed: SEED } : {}),
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: input },
          ],
        }),
      ),
    );

    const parsed: T[] = [];
    const raw: unknown[] = [];

    for (const result of settled) {
      if (result.status === 'rejected') {
        this.logger.warn(`Sample failed: ${String(result.reason)}`);
        continue;
      }
      const content = result.value.choices[0]?.message?.content;
      if (!content) continue;
      try {
        // JSON mode makes this valid by construction unless the reply was
        // truncated at max_tokens, which would otherwise lose good samples.
        parsed.push(JSON.parse(content) as T);
        raw.push(result.value);
      } catch {
        this.logger.warn('Discarded a sample that did not parse as JSON');
      }
    }

    if (parsed.length === 0) {
      throw new ServiceUnavailableException(
        'The model returned nothing usable',
      );
    }

    if (parsed.length < samples) {
      this.logger.warn(
        `Scored on ${parsed.length} of ${samples} samples for ${promptName}`,
      );
    }

    return { parsed, raw, model };
  }
}
