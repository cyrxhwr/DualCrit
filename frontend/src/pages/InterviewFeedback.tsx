import { useEffect, useState, type ReactNode } from 'react';
import { Sparkles, Star } from 'lucide-react';
import { api, type StoredEvaluation } from '../lib/api';

interface Props {
  activityId: string;
  onContinue: () => void;
}

/**
 * Render the model's own emphasis markers.
 *
 * The model writes the sentence *and* the `**markers**`, so this is a plain
 * parse rather than a match against separate source text — nothing has to be
 * located, and a stray marker degrades to ordinary words.
 */
function withEmphasis(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={i} className="font-semibold text-emerald-950 bg-emerald-100 rounded px-0.5">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/** The student's own interview, scored against the five rubric standards. */
export default function InterviewFeedback({
  activityId,
  onContinue,
}: Props) {
  const [evaluation, setEvaluation] = useState<StoredEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .interviewFeedback(activityId)
      .then((result) => {
        setEvaluation(result.evaluation);
        setError(null);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load feedback'),
      )
      .finally(() => setLoading(false));
  }, [activityId]);

  if (loading) {
    return (
      <p className="flex items-center justify-center gap-2 text-sm text-gray-500 py-12">
        <Sparkles className="h-4 w-4 animate-pulse" />
        Scoring your interview…
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {error}
      </p>
    );
  }

  if (!evaluation) {
    return (
      <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
        AI feedback is not configured on this server, so your interview has no
        scores.
      </p>
    );
  }

  const criteria = evaluation.feedback.criteria ?? [];

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-1">
        Post-interview evaluation
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        Scored on how you followed up, not on the opening question your team
        chose.
      </p>

      <div className="space-y-5">
        {criteria.map((criterion) => (
          <article
            key={criterion.standard}
            className="border border-gray-200 rounded-lg p-6"
          >
            <div className="flex items-center justify-between gap-4 mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                {criterion.standard}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xl font-bold text-emerald-600">
                  {criterion.score}
                  <span className="text-sm font-normal text-gray-500">/5</span>
                </span>
                <span className="flex" aria-label={`${criterion.score} out of 5`}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star
                      key={i}
                      aria-hidden="true"
                      className={`w-4 h-4 ${
                        i < Math.round(criterion.score)
                          ? 'text-yellow-400 fill-current'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </span>
              </div>
            </div>

            <div className="bg-emerald-50 rounded-lg p-4">
              <p className="text-emerald-900 leading-relaxed break-words">
                {withEmphasis(criterion.response)}
              </p>
            </div>
          </article>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 mt-8">
        <p className="text-sm text-gray-500">
          Last step: everything you and your team produced, in one place.
        </p>
        <button
          type="button"
          onClick={onContinue}
          className="shrink-0 bg-green-600 text-white rounded px-6 py-1.5 text-sm font-medium hover:bg-green-700"
        >
          See my summary
        </button>
      </div>
    </div>
  );
}
