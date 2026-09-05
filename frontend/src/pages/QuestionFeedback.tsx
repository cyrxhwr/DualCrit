import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Sparkles } from 'lucide-react';
import { api, type StoredEvaluation } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useActivityRoom } from '../lib/useActivityRoom';
import { describeMistake, isNoIssue } from '../lib/rubric';
import { withEmphasis } from '../lib/emphasis';

interface Props {
  activityId: string;
  question: string;
  onContinue: () => void;
}

/**
 * AI feedback on the question the team voted for.
 *
 * One evaluation per team, not per student — everyone is looking at the same
 * question, so everyone sees the same notes.
 */
export default function QuestionFeedback({
  activityId,
  question,
  onContinue,
}: Props) {
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
        The same notes for everyone — it is the team’s question.
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-800 mb-2 text-sm">
          Selected question
        </h3>
        <p className="text-blue-700 text-lg break-words">“{question}”</p>
      </div>

      {loading && (
        <p className="flex items-center gap-2 text-sm text-gray-500 py-4">
          <Sparkles className="h-4 w-4 animate-pulse" />
          Reading your question…
        </p>
      )}

      {error && <p className="note note-error">{error}</p>}

      {!loading && !error && !evaluation && (
        <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          AI feedback is not configured on this server, so this step has no
          notes. The rest of the activity still works.
        </p>
      )}

      {issues.length > 0 && (
        <div className="space-y-4 stagger">
          <div className="note note-attention p-4">
            <h3 className="font-semibold mb-2 text-sm">Identified issues</h3>
            <div className="flex flex-wrap gap-2">
              {issues.map((item, i) => (
                <span
                  key={`${item.mistake}-${i}`}
                  className="badge badge-accent text-sm px-3 py-1"
                >
                  {item.mistake}
                </span>
              ))}
            </div>
          </div>

          {issues.map((item, i) => (
            <article
              key={`${item.mistake}-detail-${i}`}
              className="panel smooth-hover p-6"
            >
              <h3 className="text-lg font-bold text-gray-800 mb-1">
                {item.mistake}
              </h3>
              {describeMistake(item.mistake) && (
                <p className="text-gray-600 mb-4 text-sm">
                  {describeMistake(item.mistake)}
                </p>
              )}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0 text-blue-600 font-bold text-xs">
                    AI
                  </span>
                  <div>
                    <h4 className="font-semibold text-blue-800 mb-1 text-sm">
                      AI feedback
                    </h4>
                    <p className="text-blue-700 text-sm leading-relaxed break-words">
                      {withEmphasis(item.explanation)}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {isSound && (
        <div className="note note-good p-8">
          <div className="flex items-center gap-4 mb-6">
            <span className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
              <CheckCircle className="w-7 h-7 text-blue-600" />
            </span>
            <div>
              <h3 className="text-xl font-bold text-blue-800">
                Excellent question
              </h3>
              <p className="text-blue-600 text-sm">
                No rubric issues were found
              </p>
            </div>
          </div>

          {items[0]?.explanation && (
            <div className="bg-white border border-blue-100 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0 text-blue-600 font-bold text-xs">
                  AI
                </span>
                <div>
                  <h4 className="font-semibold text-blue-800 mb-1 text-sm">
                    AI feedback
                  </h4>
                  <p className="text-blue-700 text-sm leading-relaxed break-words">
                    {withEmphasis(items[0].explanation)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="flex justify-end mt-8">
        <button
          type="button"
          onClick={onContinue}
          disabled={loading}
          className="btn btn-primary"
        >
          Start my interview
        </button>
      </div>
    </div>
  );
}
