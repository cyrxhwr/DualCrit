import { ArrowRight } from 'lucide-react';
import { withEmphasis } from '../lib/emphasis';

interface Props {
  /** Absent or empty when the entry is already fully met. */
  text?: string | null;
}

/**
 * The "what to do next" line under a piece of feedback.
 *
 * Deliberately set apart from the explanation above it rather than folded into
 * the same paragraph: a next step buried in a block of diagnosis does not read
 * as one, and whether students can find it is measured directly.
 */
export default function NextStep({ text }: Props) {
  if (!text?.trim()) return null;

  return (
    <p className="mt-2 flex items-start gap-2 text-sm text-gray-700">
      <ArrowRight
        aria-hidden="true"
        className="h-4 w-4 shrink-0 mt-0.5 text-[#f0704f]"
      />
      <span>
        <span className="font-semibold text-gray-800">Try next: </span>
        {withEmphasis(text)}
      </span>
    </p>
  );
}
