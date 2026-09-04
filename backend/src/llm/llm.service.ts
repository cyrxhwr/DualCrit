import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import OpenAI from 'openai';

/**
 * Matches the model the previous system used for evaluations, so feedback is
 * comparable with anything collected before. Override with OPENAI_MODEL —
 * gpt-4o-mini is far cheaper if exact comparability stops mattering.
 */
export const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o';

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
}
