import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Users, Vote } from 'lucide-react';
import { api, type Contribution, type PovHmwData } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useActivityMembers } from '../lib/useActivityMembers';
import { useVoting } from '../lib/useVoting';
import ResearchBrief from '../components/ResearchBrief';
import HmwTypes from '../components/HmwTypes';

interface Props {
  activityId: string;
  pov: string | null;
  onDecided: () => void;
}

const TYPE = 'hmw_question';

/** Three each, and the team picks three — as in the previous system. */
export const PER_STUDENT = 3;
export const PICK = 3;

/**
 * Each student writes three HMW questions, then the team votes for three.
 *
 * The three are submitted as separate contributions with order indexes 1–3,
 * which is what lets the team vote on individual questions rather than on a
 * whole person's set.
 */
export default function HmwCreation({ activityId, pov, onDecided }: Props) {
  const [questions, setQuestions] = useState<Contribution[]>([]);
  const [research, setResearch] = useState<PovHmwData | null>(null);
  const [drafts, setDrafts] = useState<string[]>(Array(PER_STUDENT).fill(''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  const { members, connected } = useActivityMembers(activityId);
  const voting = useVoting(activityId, TYPE);

  const refresh = useCallback(async () => {
    try {
      const [list, data] = await Promise.all([
        api.listContributions(activityId, TYPE),
        api.povHmwData(activityId),
      ]);
      setQuestions(list);
      setResearch(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load');
    }
  }, [activityId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (connected) void refresh();
  }, [connected, refresh]);

  useEffect(() => {
    const socket = getSocket();
    const onChanged = (p: { activityId: string; type: string }) => {
      if (p.activityId === activityId && p.type === TYPE) void refresh();
    };
    socket.on('contributions:changed', onChanged);
    return () => {
      socket.off('contributions:changed', onChanged);
    };
  }, [activityId, refresh]);

  const mine = questions.filter((q) => q.isMine);
  useEffect(() => {
    if (mine.length === 0) return;
    const byOrder = [...mine].sort((a, b) => a.orderIndex - b.orderIndex);
    setDrafts(
      Array.from(
        { length: PER_STUDENT },
        (_, i) => byOrder[i]?.content.question ?? '',
      ),
    );
    // Comparing the texts rather than the array keeps this from re-running on
    // every refresh that returns an equivalent list.
  }, [mine.map((m) => m.content.question).join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (voting.myVote.length > 0) setPicked(voting.myVote);
  }, [voting.myVote]);

  const memberCount = members.length;
  const everyoneSubmitted =
    memberCount > 0 && questions.length >= memberCount * PER_STUDENT;
  const inVoting = voting.state?.status === 'active';
  const decided = voting.state?.status === 'completed';

  const announced = useRef(false);
  useEffect(() => {
    if (decided && !announced.current) {
      announced.current = true;
      onDecided();
    }
  }, [decided, onDecided]);

  const allFilled = drafts.every((d) => d.trim().length > 0);
  const hasSubmitted = mine.length >= PER_STUDENT;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      // Sequential, not parallel: three upserts on the same (activity,
      // student, type) row family, and the order index is what separates
      // them — sending them together risks the server seeing them out of order.
      for (let i = 0; i < PER_STUDENT; i++) {
        await api.submitContribution(activityId, TYPE, drafts[i].trim(), i + 1);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) => {
    setPicked((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : current.length >= PICK
          ? current
          : [...current, id],
    );
  };

  const sameAsSaved =
    picked.length === voting.myVote.length &&
    picked.every((id) => voting.myVote.includes(id));

  if (decided) {
    const winners = voting.state?.winners ?? [];
    const chosen = questions.filter(
      (q) => winners.includes(q.id) || q.isSelected,
    );
    return (
      <div className="py-6 fade-in">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">
          Your team's HMW questions
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          These are the seeds you would take into a brainstorm.
        </p>
        <ul className="space-y-2">
          {chosen.map((q) => (
            <li
              key={q.id}
              className="border-l-4 border-blue-500 bg-blue-50 rounded-r-lg p-4 text-gray-800"
            >
              {q.content.question}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div>
      <div key={inVoting ? 'vote' : 'write'} className="fade-in">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-gray-800">
            {inVoting
              ? `Vote for the top ${PICK} HMW questions`
              : 'Write your HMW questions'}
          </h2>
          <span className="flex items-center gap-1.5 text-sm text-gray-500">
            <Users className="h-4 w-4" />
            {inVoting
              ? `${voting.state?.votedCount ?? 0} of ${memberCount} voted`
              : `${questions.length} of ${memberCount * PER_STUDENT} submitted`}
          </span>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          {inVoting
            ? `Questions are anonymous — choose ${PICK} to take into a brainstorm.`
            : `Everyone writes ${PER_STUDENT}. The team then picks ${PICK}.`}
        </p>

        {inVoting ? (
          <p className="note note-good mb-5 flex items-center gap-2">
            <Vote className="h-4 w-4 shrink-0" />
            <span>
              <b>Voting is open.</b> Pick {PICK} below, then press Submit vote.
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
              {memberCount * PER_STUDENT} so far.
            </p>
          )
        )}
      </div>

      {research && (
        <ResearchBrief
          needs={research.needs}
          insights={research.insights}
          pov={pov}
        />
      )}

      {(error ?? voting.error) && (
        <p className="note note-error mb-4">{error ?? voting.error}</p>
      )}

      {!inVoting && <HmwTypes />}

      {!inVoting && (
        <div className="mb-6 space-y-3">
          {drafts.map((draft, i) => (
            <div key={i}>
              <label
                htmlFor={`hmw-${i}`}
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                HMW question {i + 1}
              </label>
              <textarea
                id={`hmw-${i}`}
                value={draft}
                onChange={(e) => {
                  const next = [...drafts];
                  next[i] = e.target.value;
                  setDrafts(next);
                }}
                rows={2}
                maxLength={400}
                placeholder="How might we…"
                className="field"
              />
            </div>
          ))}

          <div className="note note-attention">
            <p className="font-semibold mb-1">Writing an HMW that works</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Start with "How might we…"</li>
              <li>
                Broad enough for many answers, narrow enough to provoke a
                specific one
              </li>
              <li>Pose the problem — do not name the solution</li>
              <li>Build on your team's POV, not on design in general</li>
            </ul>
          </div>

          <div className="flex items-center justify-end gap-3">
            {hasSubmitted && (
              <span className="flex items-center gap-1.5 text-sm text-blue-700">
                <Check className="h-4 w-4" />
                Submitted
              </span>
            )}
            {!allFilled && (
              <span className="text-sm text-gray-500">
                Write all {PER_STUDENT} first
              </span>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={busy || !allFilled}
              className="btn btn-primary"
            >
              {busy
                ? 'Saving…'
                : hasSubmitted
                  ? 'Update my questions'
                  : 'Submit my questions'}
            </button>
          </div>
        </div>
      )}

      <ul className="space-y-3 stagger">
        {questions.map((question) => {
          const votes = voting.state?.tally[question.id] ?? 0;
          const isPicked = picked.includes(question.id);
          const atLimit = picked.length >= PICK && !isPicked;

          return (
            <li key={question.id}>
              <button
                type="button"
                disabled={!inVoting || atLimit}
                onClick={() => toggle(question.id)}
                aria-pressed={isPicked}
                className="selectable w-full p-4"
              >
                <div className="flex items-start gap-3">
                  {inVoting && (
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 shrink-0 w-4 h-4 rounded flex items-center justify-center transition-colors border-2 ${
                        isPicked
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-gray-300'
                      }`}
                    >
                      {isPicked && <Check className="h-3 w-3 text-white" />}
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
                    Yours
                  </p>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {questions.length === 0 && (
        <p className="text-sm text-gray-400 py-4">
          Nobody has submitted questions yet.
        </p>
      )}

      <div className="flex items-center justify-end gap-3 mt-6">
        {!inVoting && everyoneSubmitted && (
          <button
            type="button"
            onClick={() => void voting.start(PICK)}
            className="btn btn-primary"
          >
            <Vote className="h-4 w-4" />
            Start voting for the team
          </button>
        )}

        {inVoting && (
          <>
            <span className="text-sm text-gray-500">
              {picked.length} of {PICK} picked
            </span>
            <button
              type="button"
              disabled={picked.length !== PICK || sameAsSaved}
              onClick={() => void voting.castVote(picked)}
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
