import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api, type ScoredSet } from '../lib/api';
import ScoredItemCard from '../components/ScoredItemCard';

interface Props {
  activityId: string;
  onContinue: () => void;
}

/**
 * Every member's POV statement, scored together.
 *
 * Deliberately not only the winner: seeing how your own statement scored
 * beside the one the team chose is the point of the step, and it is what the
 * previous system did.
 */
export default function PovFeedback({ activityId, onContinue }: Props) {
  const [scored, setScored] = useState<ScoredSet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .povFeedback(activityId)
      .then((r) => {
        if (cancelled) return;
        setScored(r.evaluation?.feedback ?? null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : 'Could not load feedback',
        );
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activityId]);

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-1">
        AI feedback on your team's POV statements
      </h2>
      <p className="text-sm text-gray-500 mb-5">
        Every statement scored against the d.school's criteria, so you can see
        how yours compared with the one the team chose.
      </p>

      {loading && (
        <p className="flex items-center gap-2 text-sm text-gray-500 py-8">
          <Sparkles className="h-4 w-4 animate-pulse" />
          Reading your team's statements…
        </p>
      )}

      {error && <p className="note note-error mb-4">{error}</p>}

      {!loading && !error && !scored && (
        <p className="note mb-4 text-gray-600 bg-transparent border-gray-200">
          Feedback is not available for this activity.
        </p>
      )}

      {scored && (
        <div className="space-y-4 stagger">
          {scored.items.map((item, i) => (
            <ScoredItemCard
              key={i}
              item={item}
              selectedLabel="Your team chose this"
            />
          ))}
        </div>
      )}

      <div className="flex justify-end mt-8">
        <button
          type="button"
          onClick={onContinue}
          disabled={loading}
          className="btn btn-primary"
        >
          Write HMW questions
        </button>
      </div>
    </div>
  );
}
