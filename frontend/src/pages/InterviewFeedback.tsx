import { useEffect, useState } from 'react';
import { Sparkles, Star } from 'lucide-react';
import { api, type StoredEvaluation } from '../lib/api';
import { withEmphasis } from '../lib/emphasis';

interface Props {
  activityId: string;
  onContinue: () => void;
}

/** The student's own interview, scored against the five rubric standards. */
export default function InterviewFeedback({ activityId, onContinue }: Props) {
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
        setError(
          err instanceof Error ? err.message : 'Could not load feedback',
        ),
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
    return <p className="note note-error">{error}</p>;
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

      <div className="space-y-5 stagger">
        {criteria.map((criterion) => (
          <article key={criterion.standard} className="panel smooth-hover p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                {criterion.standard}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xl font-bold text-blue-600">
                  {criterion.score}
                  <span className="text-sm font-normal text-gray-500">/5</span>
                </span>
                <span
                  className="flex"
                  aria-label={`${criterion.score} out of 5`}
                >
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star
                      key={i}
                      aria-hidden="true"
                      className={`w-4 h-4 ${
                        i < Math.round(criterion.score)
                          ? 'text-[#f0704f] fill-current'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </span>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-blue-900 leading-relaxed break-words">
                {withEmphasis(criterion.response)}
              </p>
            </div>
          </article>
        ))}
      </div>
      <div className="flex justify-end mt-8">
        <button type="button" onClick={onContinue} className="btn btn-primary">
          See my summary
        </button>
      </div>
    </div>
  );
}
