/**
 * The mistake classes the AI tags a question with.
 *
 * Titles are carried over verbatim from the previous system and are what the
 * model returns, so they double as the lookup key. Editing a title means
 * editing the prompt to match.
 */
export interface MistakeType {
  title: string;
  description: string;
}

export const MISTAKE_TYPES: MistakeType[] = [
  {
    title: 'Closed Question',
    description: 'Yes/No or single-word responses that limit insight',
  },
  {
    title: 'Too Broad/Abstract',
    description: 'Vague themes that lack specificity',
  },
  {
    title: 'Premature Solution',
    description: 'Introduces solutions before exploring user problems',
  },
  {
    title: 'Double-barreled',
    description: 'Combines two questions into one',
  },
  {
    title: 'Leading or Biased Framing',
    description: 'Suggests an answer or embeds assumptions',
  },
  {
    title: 'Lacks User Relevance',
    description: 'Does not connect clearly to the user experience or role',
  },
  {
    title: 'Overly Narrow',
    description:
      'Frames the problem so tightly that alternative insights are excluded',
  },
  {
    title: 'Unclear Purpose or Flow',
    description:
      'The question does not fit logically in the sequence or does not relate to clear objectives',
  },
];

export const describeMistake = (title: string): string | undefined =>
  MISTAKE_TYPES.find((m) => m.title === title)?.description;

/** The model uses "None" when the question violates nothing. */
export const isNoIssue = (title: string): boolean =>
  title.trim().toLowerCase() === 'none';
