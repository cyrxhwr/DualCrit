import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  api,
  type PovHmwSummary as Summary,
  type SummaryScoredItem,
} from '../lib/api';
import ScoredItemCard from '../components/ScoredItemCard';
import ResearchBrief from '../components/ResearchBrief';
import SummaryActions from '../components/SummaryActions';

interface Props {
  activityId: string;
  onFinish: () => void;
}

/**
 * Everything the student produced in the POV & HMW workflow, in one place.
 *
 * Assembled from stored rows rather than regenerated, so it matches what they
 * were shown at each step.
 */
export default function PovHmwSummary({ activityId, onFinish }: Props) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .povHmwSummary(activityId)
      .then(setSummary)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load summary'),
      );
  }, [activityId]);

  if (error && !summary) {
    return <p className="note note-error">{error}</p>;
  }

  if (!summary) {
    return <p className="text-gray-500 py-8 text-center">Loading…</p>;
  }

  const list = (title: string, items: string[], accent = false) =>
    items.length > 0 && (
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}</h3>
        <ol className="space-y-2">
          {items.map((text, i) => (
            <li
              key={i}
              className={
                accent
                  ? 'border-l-4 border-blue-500 bg-blue-50 rounded-r-lg p-4 text-gray-800'
                  : 'panel p-4 text-gray-800'
              }
            >
              {text}
            </li>
          ))}
        </ol>
      </section>
    );

  const scored = (title: string, blurb: string, items: SummaryScoredItem[]) =>
    items.length > 0 && (
      <section>
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <p className="text-sm text-gray-500 mb-3">{blurb}</p>
        <div className="space-y-4">
          {items.map((item, i) => (
            <ScoredItemCard
              key={i}
              item={item}
              isMine={item.isMine}
              selectedLabel="Your team chose this"
            />
          ))}
        </div>
      </section>
    );

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-1">
        <h2 className="text-lg font-semibold text-gray-800">
          Your session summary
        </h2>
        <SummaryActions
          text={summary.summaryText}
          activityName={summary.activityName}
          onError={setError}
        />
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Your point of view and questions beside your team's, with the feedback
        on both.
      </p>

      {!summary.saved && (
        <p className="note note-attention mb-5 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          This could not be saved to your record. Download a copy and tell your
          instructor.
        </p>
      )}

      {(summary.needs.length > 0 || summary.insights.length > 0) && (
        <ResearchBrief
          needs={summary.needs}
          insights={summary.insights}
          pov={summary.teamPov}
        />
      )}

      <div className="space-y-6 stagger">
        {scored(
          "Feedback on your team's POV statements",
          'Every statement your team wrote, scored together.',
          summary.povFeedback,
        ) ||
          (summary.myPov && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                The POV statement you wrote
              </h3>
              <p className="panel p-4 text-gray-800">{summary.myPov}</p>
            </section>
          ))}

        {scored(
          'Feedback on the HMW questions',
          'The three your team chose, and your own — a question that is both appears once.',
          summary.hmwFeedback,
        ) || (
          <>
            {list('The HMW questions you wrote', summary.myHmw)}
            {list(
              'The HMW questions your team chose',
              summary.teamHmw,
              /* accent */ true,
            )}
          </>
        )}
      </div>

      <div className="flex justify-end mt-8">
        <button type="button" onClick={onFinish} className="btn btn-primary">
          Back to my activities
        </button>
      </div>
    </div>
  );
}
