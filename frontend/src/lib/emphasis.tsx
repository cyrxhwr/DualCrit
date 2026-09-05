import type { ReactNode } from 'react';

/**
 * Render the `**markers**` the evaluator writes into its own prose.
 *
 * Students skim feedback, so the prompts ask the model to mark the phrase that
 * carries each point. The model writes the sentence *and* the markers, so this
 * is a plain parse rather than a match against separate source text — nothing
 * has to be located, and a stray marker degrades to ordinary words.
 *
 * Not a markdown renderer: nothing else in the text is interpreted.
 */
export function withEmphasis(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong
        key={i}
        className="font-semibold text-blue-950 bg-blue-100 rounded px-0.5"
      >
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
