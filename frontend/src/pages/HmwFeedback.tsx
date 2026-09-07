import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api, type ScoredSet } from '../lib/api';
import ScoredItemCard from '../components/ScoredItemCard';

interface Props {
  activityId: string;
  onContinue: () => void;
}

/**
 * Two sets side by side: the student's own three questions and the three the
 * team voted for. The comparison is the lesson, as in the previous system.
 */
export default function HmwFeedback({ activityId, onContinue }: Props) {
  const [mine, setMine] = useState<ScoredSet | null>(null);
  const [team, setTeam] = useState<ScoredSet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .hmwFeedback(activityId)
      .then((r) => {
        if (cancelled) return;
        setMine(r.mine?.feedback ?? null);
        setTeam(r.team?.feedback ?? null);
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

  const section = (title: string, blurb: string, set: ScoredSet | null) =>
    set &&
    set.items.length > 0 && (
      <section>
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <p className="text-sm text-gray-500 mb-3">{blurb}</p>
        <div className="space-y-4">
          {set.items.map((item, i) => (
            <ScoredItemCard key={i} item={item} />
          ))}
        </div>
      </section>
    );

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-1">
        AI feedback on the HMW questions
      </h2>
      <p className="text-sm text-gray-500 mb-5">
        Your own three and your team's chosen three, scored the same way.
      </p>

      {loading && (
        <p className="flex items-center gap-2 text-sm text-gray-500 py-8">
          <Sparkles className="h-4 w-4 animate-pulse" />
          Reading the questions…
        </p>
      )}

      {error && <p className="note note-error mb-4">{error}</p>}

      {!loading && !error && !mine && !team && (
        <p className="note mb-4 text-gray-600 bg-transparent border-gray-200">
          Feedback is not available for this activity.
        </p>
      )}

      <div className="space-y-8">
        {section(
          'Your questions',
          'The three you wrote, whether or not the team picked them.',
          mine,
        )}
        {section(
          "Your team's chosen questions",
          'The three that won the vote — these are the brainstorm seeds.',
          team,
        )}
      </div>

      <div className="flex justify-end mt-8">
        <button
          type="button"
          onClick={onContinue}
          disabled={loading}
          className="btn btn-primary"
        >
          See my summary
        </button>
      </div>
    </div>
  );
}
