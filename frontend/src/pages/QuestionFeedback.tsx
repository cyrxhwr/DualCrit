import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { api, type StoredEvaluation } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useActivityRoom } from '../lib/useActivityRoom';

interface Props {
  activityId: string;
  question: string;
}

const MISTAKE_LABELS: Record<string, string> = {
  closed_question: 'Closed question',
  too_broad: 'Too broad',
  premature_solution: 'Premature solution',
  double_barrelled: 'Double-barrelled',
  leading: 'Leading or biased',
  lacks_relevance: 'Lacks user relevance',
  overly_narrow: 'Overly narrow',
  unclear_purpose: 'Unclear purpose',
};

const VERDICTS: Record<string, { label: string; className: string }> = {
  strong: { label: 'Strong question', className: 'bg-green-50 text-green-800' },
  workable: { label: 'Workable', className: 'bg-blue-50 text-blue-800' },
  needs_work: { label: 'Needs work', className: 'bg-amber-50 text-amber-800' },
};

/**
 * AI feedback on the question the team voted for.
 *
 * One evaluation per team, not per student — everyone is looking at the same
 * question, so everyone sees the same feedback.
 */
export default function QuestionFeedback({ activityId, question }: Props) {
  const [evaluation, setEvaluation] = useState<StoredEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useActivityRoom(activityId);

  const load = useCallback(async () => {
    try {
      const result = await api.questionFeedback(activityId);
      setEvaluation(result.evaluation);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get feedback');
    } finally {
      setLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Whoever asked first pays for the call; this tells everyone else it landed.
  useEffect(() => {
    const socket = getSocket();
    const onReady = (payload: { activityId: string }) => {
      if (payload.activityId !== activityId) return;
      void api
        .readQuestionFeedback(activityId)
        .then((r) => setEvaluation(r.evaluation))
        .catch(() => undefined);
    };
    socket.on('evaluation:ready', onReady);
    return () => {
      socket.off('evaluation:ready', onReady);
    };
  }, [activityId]);

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-1">
        Feedback on your team's question
      </h2>
      <p className="text-sm text-gray-500 mb-5">
        This looks at the question you all chose, so everyone sees the same
        notes.
      </p>

      <blockquote className="border-l-4 border-violet-500 bg-violet-50 rounded-r-lg p-5 mb-6">
        <p className="text-gray-800">{question}</p>
      </blockquote>

      {loading && (
        <p className="flex items-center gap-2 text-sm text-gray-500 py-4">
          <Sparkles className="h-4 w-4 animate-pulse" />
          Reading your question…
        </p>
      )}

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {!loading && !error && !evaluation && (
        <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          AI feedback is not configured on this server, so this step has no
          notes. The rest of the activity still works.
        </p>
      )}

      {evaluation && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <span
              className={`text-sm font-medium px-3 py-1 rounded-full ${
                VERDICTS[evaluation.feedback.verdict]?.className ??
                'bg-gray-100 text-gray-700'
              }`}
            >
              {VERDICTS[evaluation.feedback.verdict]?.label ??
                evaluation.feedback.verdict}
            </span>
          </div>

          <p className="text-gray-800">{evaluation.feedback.summary}</p>

          {evaluation.feedback.strengths.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                What works
              </h3>
              <ul className="space-y-2">
                {evaluation.feedback.strengths.map((strength, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    {strength}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {evaluation.feedback.mistakes.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Worth reconsidering
              </h3>
              <ul className="space-y-3">
                {evaluation.feedback.mistakes.map((mistake, i) => (
                  <li
                    key={i}
                    className="border border-amber-200 bg-amber-50 rounded-lg p-4"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="h-4 w-4 text-amber-700" />
                      <span className="text-sm font-medium text-amber-900">
                        {MISTAKE_LABELS[mistake.type] ?? mistake.type}
                      </span>
                    </div>
                    {mistake.quote && (
                      <p className="text-sm text-amber-900 italic mb-1">
                        “{mistake.quote}”
                      </p>
                    )}
                    <p className="text-sm text-amber-900">
                      {mistake.explanation}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-xs text-gray-400 pt-2">
            Generated once for the team{evaluation.model ? ` · ${evaluation.model}` : ''}
          </p>
        </div>
      )}

      <p className="text-sm text-gray-400 mt-8">
        Next each of you runs your own interview with this question. That step
        is not built yet.
      </p>
    </div>
  );
}
