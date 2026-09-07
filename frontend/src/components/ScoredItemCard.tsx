import { Star } from 'lucide-react';
import type { ScoredItem } from '../lib/api';
import { withEmphasis } from '../lib/emphasis';
import NextStep from './NextStep';

interface Props {
  item: ScoredItem;
  /** Wording for the badge on the entry the team voted for. */
  selectedLabel?: string;
  /**
   * Marks this as the reader's own. Only used after the vote has closed —
   * during voting the sets stay anonymous.
   */
  isMine?: boolean;
}

const mean = (item: ScoredItem) =>
  item.criteria.length === 0
    ? 0
    : item.criteria.reduce((a, c) => a + c.score, 0) / item.criteria.length;

/**
 * One POV statement or HMW question with its rubric scores.
 *
 * POV and HMW are scored on different standards but share this shape, so the
 * two feedback screens render through one component and stay consistent.
 */
export default function ScoredItemCard({ item, selectedLabel, isMine }: Props) {
  const average = mean(item);

  return (
    <article
      className={`panel p-5 ${item.isSelected ? 'ring-1 ring-blue-500' : ''}`}
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <p className="text-gray-900 font-medium">{item.text}</p>
        <span className="shrink-0 text-sm font-semibold text-blue-600 tabular-nums">
          {average.toFixed(1)}
          <span className="text-xs font-normal text-gray-400">/5</span>
        </span>
      </div>

      {(isMine || (item.isSelected && selectedLabel)) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {isMine && <span className="badge badge-accent">Yours</span>}
          {item.isSelected && selectedLabel && (
            <span className="badge badge-brand">{selectedLabel}</span>
          )}
        </div>
      )}

      <dl className="space-y-3 mt-3">
        {item.criteria.map((criterion) => (
          <div key={criterion.standard}>
            <dt className="flex items-center justify-between gap-3 mb-1">
              <span className="text-sm font-semibold text-gray-800">
                {criterion.standard}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-semibold text-blue-600 tabular-nums">
                  {criterion.score}
                  <span className="text-xs font-normal text-gray-400">/5</span>
                </span>
                <span
                  className="flex"
                  aria-label={`${criterion.score} out of 5`}
                >
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star
                      key={i}
                      aria-hidden="true"
                      className={`w-3.5 h-3.5 ${
                        i < Math.round(criterion.score)
                          ? 'text-[#f0704f] fill-current'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </span>
              </span>
            </dt>
            <dd>
              <span className="block text-sm text-blue-900 bg-blue-50 rounded-lg p-3 leading-relaxed">
                {withEmphasis(criterion.reason)}
              </span>
              <NextStep text={criterion.nextStep} />
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
