import { useCallback, useEffect, useState } from 'react';
import { Check, Users } from 'lucide-react';
import { api, type Contribution } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useActivityRoom } from '../lib/useActivityRoom';
import { useVoting } from '../lib/useVoting';
import { scenarioByTag } from '../lib/scenarios';

interface Props {
  activityId: string;
  scenarioTag: string | null;
}

const TYPE = 'interview_question';

/**
 * Each student writes one interview question, then the team votes on them.
 *
 * Voting only opens once everyone has submitted, so nobody's question is
 * missing from the ballot.
 */
export default function QuestionCreation({ activityId, scenarioTag }: Props) {
  const [questions, setQuestions] = useState<Contribution[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  useActivityRoom(activityId);
  const voting = useVoting(activityId, TYPE);
  const scenario = scenarioTag ? scenarioByTag(scenarioTag) : undefined;

  const refresh = useCallback(async () => {
    try {
      setQuestions(await api.listContributions(activityId, TYPE));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load questions');
    }
  }, [activityId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Each client re-reads for itself, so nobody receives another student's
  // view of who wrote what.
  useEffect(() => {
    const socket = getSocket();
    const onChanged = (payload: { activityId: string; type: string }) => {
      if (payload.activityId === activityId && payload.type === TYPE) {
        void refresh();
      }
    };
    socket.on('contributions:changed', onChanged);
    return () => {
      socket.off('contributions:changed', onChanged);
    };
  }, [activityId, refresh]);

  const mine = questions.find((q) => q.isMine);
  useEffect(() => {
    if (mine?.content.question) setDraft(mine.content.question);
  }, [mine]);

  useEffect(() => {
    if (voting.myVote.length > 0) setPicked(voting.myVote[0]);
  }, [voting.myVote]);

  const memberCount = voting.state?.memberCount ?? 0;
  const everyoneSubmitted =
    memberCount > 0 && questions.length >= memberCount;
  const inVoting = voting.state?.status === 'active';
  const decided = voting.state?.status === 'completed';

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      setQuestions(await api.submitContribution(activityId, TYPE, draft.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  if (decided) {
    const winner = questions.find((q) => q.isSelected);
    return (
      <div className="py-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">
          Your team's question
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          This is the question everyone will use for their interview.
        </p>
        <blockquote className="border-l-4 border-violet-500 bg-violet-50 rounded-r-lg p-5">
          <p className="text-gray-800">{winner?.content.question}</p>
          {winner && (
            <footer className="text-xs text-gray-500 mt-2">
              written by {winner.authorName}
            </footer>
          )}
        </blockquote>
        <p className="text-sm text-gray-400 mt-6">
          AI feedback on this question is the next step, and is not built yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-gray-800">
          {inVoting ? 'Vote for the best question' : 'Write your question'}
        </h2>
        <span className="flex items-center gap-1.5 text-sm text-gray-500">
          <Users className="h-4 w-4" />
          {inVoting
            ? `${voting.state?.votedCount ?? 0} of ${memberCount} voted`
            : `${questions.length} of ${memberCount || '…'} submitted`}
        </span>
      </div>

      {scenario && (
        <p className="text-sm text-gray-500 mb-5">
          You are interviewing {scenario.persona.name} —{' '}
          {scenario.persona.role.toLowerCase()}.
        </p>
      )}

      {(error ?? voting.error) && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error ?? voting.error}
        </p>
      )}

      {!inVoting && (
        <div className="mb-6">
          <label htmlFor="question" className="sr-only">
            Your interview question
          </label>
          <textarea
            id="question"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="What would you ask them to understand the problem better?"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <div className="flex items-center justify-end gap-3 mt-2">
            {mine && (
              <span className="flex items-center gap-1.5 text-sm text-green-700">
                <Check className="h-4 w-4" />
                Submitted
              </span>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={busy || draft.trim().length === 0}
              className="bg-green-600 text-white rounded px-6 py-1.5 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {mine ? 'Update question' : 'Submit question'}
            </button>
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {questions.map((question) => {
          const votes = voting.state?.tally[question.id] ?? 0;
          const isPicked = picked === question.id;

          return (
            <li key={question.id}>
              <button
                type="button"
                disabled={!inVoting}
                onClick={() => setPicked(question.id)}
                aria-pressed={isPicked}
                className={`w-full text-left rounded-lg border-2 p-4 transition-colors ${
                  isPicked
                    ? 'border-violet-500 bg-violet-50'
                    : 'border-gray-200'
                } ${inVoting ? 'hover:border-gray-300' : 'cursor-default'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-gray-800">{question.content.question}</p>
                  {votes > 0 && (
                    <span className="shrink-0 text-xs bg-white border border-gray-200 text-gray-600 rounded-full px-2 py-0.5">
                      {votes}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {question.isMine ? 'You' : question.authorName}
                </p>
              </button>
            </li>
          );
        })}
      </ul>

      {questions.length === 0 && (
        <p className="text-sm text-gray-400 py-4">
          Nobody has submitted a question yet.
        </p>
      )}

      <div className="flex items-center justify-end gap-3 mt-6">
        {!inVoting && !everyoneSubmitted && questions.length > 0 && (
          <span className="text-sm text-gray-500">
            Waiting for everyone to submit…
          </span>
        )}

        {!inVoting && everyoneSubmitted && (
          <button
            type="button"
            onClick={() => void voting.start(1)}
            className="bg-violet-600 text-white rounded px-6 py-1.5 text-sm font-medium hover:bg-violet-700"
          >
            Start voting
          </button>
        )}

        {inVoting && (
          <button
            type="button"
            disabled={!picked || picked === voting.myVote[0]}
            onClick={() => picked && void voting.castVote([picked])}
            className="bg-green-600 text-white rounded px-6 py-1.5 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {voting.myVote.length > 0 ? 'Change vote' : 'Submit vote'}
          </button>
        )}
      </div>
    </div>
  );
}
