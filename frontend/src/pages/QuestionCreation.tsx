import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Users, Vote } from 'lucide-react';
import { api, type Contribution } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useActivityMembers } from '../lib/useActivityMembers';
import { useVoting } from '../lib/useVoting';
import { scenarioByTag } from '../lib/scenarios';
import PersonaBrief from '../components/PersonaBrief';

interface Props {
  activityId: string;
  scenarioTag: string | null;
  /** Fires once the team has settled on a question, so the room can advance. */
  onDecided: () => void;
}

const TYPE = 'interview_question';

/**
 * Each student writes one interview question, then the team votes on them.
 *
 * Voting only opens once everyone has submitted, so nobody's question is
 * missing from the ballot.
 */
export default function QuestionCreation({
  activityId,
  scenarioTag,
  onDecided,
}: Props) {
  const [questions, setQuestions] = useState<Contribution[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const { members, connected } = useActivityMembers(activityId);
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

  // A broadcast missed while the socket was down would otherwise leave this
  // list stale until the student reloaded.
  useEffect(() => {
    if (connected) void refresh();
  }, [connected, refresh]);

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

  // From the roster, which exists from the moment the activity starts. Taking
  // it from the voting state meant it was 0 until a round began, so "everyone
  // has submitted" could never become true and voting never opened.
  const memberCount = members.length;
  const everyoneSubmitted = memberCount > 0 && questions.length >= memberCount;
  const inVoting = voting.state?.status === 'active';
  const decided = voting.state?.status === 'completed';

  // Nothing else refetches the activity when this vote closes, so without
  // this the room stayed on the question step and the student was stuck on a
  // screen with no way forward.
  const announced = useRef(false);
  useEffect(() => {
    if (decided && !announced.current) {
      announced.current = true;
      onDecided();
    }
  }, [decided, onDecided]);
  const tied =
    voting.state?.isComplete === true &&
    (voting.state?.winners.length ?? 0) > 1;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      setQuestions(
        await api.submitContribution(activityId, TYPE, draft.trim()),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  if (decided) {
    const winningId = voting.state?.winners[0];
    const winner =
      questions.find((q) => q.id === winningId) ??
      questions.find((q) => q.isSelected);
    return (
      <div className="py-6 fade-in">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">
          Your team's question
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Everyone interviews with this.
        </p>
        <blockquote className="border-l-4 border-blue-500 bg-blue-50 rounded-r-lg p-5">
          <p className="text-gray-800">{winner?.content.question}</p>
        </blockquote>
      </div>
    );
  }

  return (
    <div>
      {/* Keyed on the phase, so arriving at voting replays the animation and
          the whole block visibly changes rather than quietly swapping words. */}
      <div key={inVoting ? 'vote' : 'write'} className="fade-in">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-gray-800">
            {inVoting ? 'Vote for the best question' : 'Write your question'}
          </h2>
          <span className="flex items-center gap-1.5 text-sm text-gray-500">
            <Users className="h-4 w-4" />
            {inVoting
              ? `${voting.state?.votedCount ?? 0} of ${memberCount} voted`
              : `${questions.length} of ${memberCount} submitted`}
          </span>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          {inVoting
            ? 'Questions are anonymous — vote for the one you would rather ask.'
            : 'Everyone writes one. The team then votes on which to use.'}
        </p>

        {inVoting ? (
          <p className="note note-good mb-5 flex items-center gap-2">
            <Vote className="h-4 w-4 shrink-0" />
            <span>
              <b>Voting is open.</b> Pick a question below, then press Submit
              vote.
            </span>
          </p>
        ) : everyoneSubmitted ? (
          <p className="note note-good mb-5 flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0" />
            <span>
              <b>Everyone has submitted.</b> Start voting when your team is
              ready — it opens for all of you at once.
            </span>
          </p>
        ) : (
          questions.length > 0 && (
            <p className="note mb-5 flex items-center gap-2 text-gray-600 bg-transparent border-gray-200">
              <Users className="h-4 w-4 shrink-0" />
              Waiting for everyone to submit — {questions.length} of{' '}
              {memberCount} so far.
            </p>
          )
        )}
      </div>

      {scenario && <PersonaBrief scenario={scenario} />}

      {tied && (
        <p className="note note-attention mb-4">
          It's a tie — change a vote to break it.
        </p>
      )}

      {(error ?? voting.error) && (
        <p className="note note-error mb-4">{error ?? voting.error}</p>
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
            className="field"
          />
          <div className="flex items-center justify-end gap-3 mt-2">
            {mine && (
              <span className="flex items-center gap-1.5 text-sm text-blue-700">
                <Check className="h-4 w-4" />
                Submitted
              </span>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={busy || draft.trim().length === 0}
              className="btn btn-primary"
            >
              {mine ? 'Update question' : 'Submit question'}
            </button>
          </div>
        </div>
      )}

      <ul className="space-y-3 stagger">
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
                className="selectable w-full p-4"
              >
                <div className="flex items-start gap-3">
                  {/* Only drawn while voting: a radio is a promise that the
                      card can be chosen, so it must not appear before it can. */}
                  {inVoting && (
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isPicked
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-gray-300'
                      }`}
                    >
                      {isPicked && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </span>
                  )}
                  <p className="flex-1 text-gray-800">
                    {question.content.question}
                  </p>
                  {votes > 0 && (
                    <span className="shrink-0 text-xs bg-white border border-gray-200 text-gray-600 rounded-full px-2 py-0.5">
                      {votes}
                    </span>
                  )}
                </div>
                {question.isMine && (
                  <p
                    className={`text-xs font-medium text-blue-600 mt-1 ${
                      inVoting ? 'ml-7' : ''
                    }`}
                  >
                    Your question
                  </p>
                )}
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
        {!inVoting && everyoneSubmitted && (
          <button
            type="button"
            onClick={() => void voting.start(1)}
            className="btn btn-primary"
          >
            <Vote className="h-4 w-4" />
            Start voting for the team
          </button>
        )}

        {inVoting && (
          <>
            {voting.myVote.length > 0 ? (
              <span className="flex items-center gap-1.5 text-sm text-blue-700">
                <Check className="h-4 w-4" />
                Vote saved
              </span>
            ) : (
              !picked && (
                <span className="text-sm text-gray-500">
                  Pick a question above first
                </span>
              )
            )}
            <button
              type="button"
              disabled={voting.busy || !picked || picked === voting.myVote[0]}
              onClick={() => picked && void voting.castVote([picked])}
              className="btn btn-primary"
            >
              {voting.myVote.length > 0 ? 'Change vote' : 'Submit vote'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
