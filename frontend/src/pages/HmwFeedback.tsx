import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api, type ScoredItem, type ScoredSet } from '../lib/api';
import ScoredItemCard from '../components/ScoredItemCard';

interface Props {
  activityId: string;
  onContinue: () => void;
}

/**
 * The team's chosen questions and the student's own, in one set.
 *
 * The server scores these as two evaluations — one over the winners, one over
 * this student's three — so a question that is both came back twice, scored by
 * two separate model calls that could disagree about the same words. They are
 * merged here the same way the summary merges them: the team's evaluation
 * wins, so a chosen question reads identically for everyone looking at it.
 */
function merge(
  team: ScoredSet | null,
  mine: ScoredSet | null,
): { item: ScoredItem; isMine: boolean }[] {
  const mineTexts = new Set((mine?.items ?? []).map((i) => i.text));
  const seen = new Set<string>();
  const merged: { item: ScoredItem; isMine: boolean }[] = [];

  // Team first, so the chosen questions lead and their scores are the ones
  // shown; the student's own that did not win follow.
  for (const item of [...(team?.items ?? []), ...(mine?.items ?? [])]) {
    if (seen.has(item.text)) continue;
    seen.add(item.text);
    merged.push({ item, isMine: mineTexts.has(item.text) });
  }

  return merged;
}

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

  const questions = useMemo(() => merge(team, mine), [team, mine]);

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-1">
        AI feedback on the HMW questions
      </h2>
      <p className="text-sm text-gray-500 mb-5">
        The three your team chose, and your own — a question that is both
        appears once.
      </p>

      {loading && (
        <p className="flex items-center gap-2 text-sm text-gray-500 py-8">
          <Sparkles className="h-4 w-4 animate-pulse" />
          Reading the questions…
        </p>
      )}

      {error && <p className="note note-error mb-4">{error}</p>}

      {!loading && !error && questions.length === 0 && (
        <p className="note mb-4 text-gray-600 bg-transparent border-gray-200">
          Feedback is not available for this activity.
        </p>
      )}

      <div className="space-y-4 stagger">
        {questions.map(({ item, isMine }, i) => (
          <ScoredItemCard
            key={i}
            item={item}
            isMine={isMine}
            selectedLabel="Your team chose this"
          />
        ))}
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
