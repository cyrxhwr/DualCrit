import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Sparkles } from 'lucide-react';
import { api, type StoredEvaluation } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useActivityRoom } from '../lib/useActivityRoom';
import { describeMistake, isNoIssue } from '../lib/rubric';

interface Props {
  activityId: string;
  question: string;
}

/**
 * AI feedback on the question the team voted for.
 *
 * One evaluation per team, not per student — everyone is looking at the same
 * question, so everyone sees the same notes.
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

  const items = evaluation?.feedback.feedback ?? [];
  const issues = items.filter((item) => !isNoIssue(item.mistake));
  const isSound = evaluation !== null && issues.length === 0;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-1">
        AI feedback on your team's question
      </h2>
      <p className="text-sm text-gray-500 mb-5">
        This looks at the question you all chose, so everyone sees the same
        notes.
      </p>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-indigo-800 mb-2 text-sm">
          Selected question
        </h3>
        <p className="text-indigo-700 text-lg break-words">“{question}”</p>
      </div>

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

      {issues.length > 0 && (
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-800 mb-2 text-sm">
              Identified issues
            </h3>
            <div className="flex flex-wrap gap-2">
              {issues.map((item, i) => (
                <span
                  key={`${item.mistake}-${i}`}
                  className="bg-yellow-200 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium"
                >
                  {item.mistake}
                </span>
              ))}
            </div>
          </div>

          {issues.map((item, i) => (
            <article
              key={`${item.mistake}-detail-${i}`}
              className="border border-gray-200 rounded-lg p-6"
            >
              <h3 className="text-lg font-bold text-gray-800 mb-1">
                {item.mistake}
              </h3>
              {describeMistake(item.mistake) && (
                <p className="text-gray-600 mb-4 text-sm">
                  {describeMistake(item.mistake)}
                </p>
              )}
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center shrink-0 text-indigo-600 font-bold text-xs">
                    AI
                  </span>
                  <div>
                    <h4 className="font-semibold text-indigo-800 mb-1 text-sm">
                      AI feedback
                    </h4>
                    <p className="text-indigo-700 text-sm leading-relaxed break-words">
                      {item.explanation}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {isSound && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-8">
          <div className="flex items-center gap-4 mb-6">
            <span className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center shrink-0">
              <CheckCircle className="w-7 h-7 text-green-600" />
            </span>
            <div>
              <h3 className="text-xl font-bold text-green-800">
                Excellent question
              </h3>
              <p className="text-green-600 text-sm">
                No rubric issues were found
              </p>
            </div>
          </div>

          {items[0]?.explanation && (
            <div className="bg-white border border-green-100 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0 text-green-600 font-bold text-xs">
                  AI
                </span>
                <div>
                  <h4 className="font-semibold text-green-800 mb-1 text-sm">
                    AI feedback
                  </h4>
                  <p className="text-green-700 text-sm leading-relaxed break-words">
                    {items[0].explanation}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {evaluation && (
        <p className="text-xs text-gray-400 pt-6">
          Generated once for the team
          {evaluation.model ? ` · ${evaluation.model}` : ''}
        </p>
      )}

      <p className="text-sm text-gray-400 mt-8">
        Next each of you runs your own interview with this question. That step
        is not built yet.
      </p>
    </div>
  );
}
