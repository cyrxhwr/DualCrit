import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Users, Vote } from 'lucide-react';
import { api, type Contribution, type PovHmwData } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useActivityMembers } from '../lib/useActivityMembers';
import { useVoting } from '../lib/useVoting';
import ResearchBrief from '../components/ResearchBrief';

interface Props {
  activityId: string;
  onDecided: () => void;
}

const TYPE = 'pov_statement';

/** The d.school madlib, shown as the placeholder so the shape is unmissable. */
const TEMPLATE =
  "[USER] needs to [USER'S NEED] because/but/surprisingly [INSIGHT]";

/**
 * Each student writes one POV statement, then the team votes on them.
 *
 * Voting only opens once everyone has submitted, so nobody's statement is
 * missing from the ballot. Statements are anonymous, as interview questions
 * are, so the team judges the framing rather than the person.
 */
export default function PovCreation({ activityId, onDecided }: Props) {
  const [statements, setStatements] = useState<Contribution[]>([]);
  const [research, setResearch] = useState<PovHmwData | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const { members, connected } = useActivityMembers(activityId);
  const voting = useVoting(activityId, TYPE);

  const refresh = useCallback(async () => {
    try {
      const [list, data] = await Promise.all([
        api.listContributions(activityId, TYPE),
        api.povHmwData(activityId),
      ]);
      setStatements(list);
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

  const mine = statements.find((s) => s.isMine);
  useEffect(() => {
    if (mine?.content.statement) setDraft(mine.content.statement);
  }, [mine]);

  useEffect(() => {
    if (voting.myVote.length > 0) setPicked(voting.myVote[0]);
  }, [voting.myVote]);

  const memberCount = members.length;
  const everyoneSubmitted = memberCount > 0 && statements.length >= memberCount;
  const inVoting = voting.state?.status === 'active';
  const decided = voting.state?.status === 'completed';
  const tied =
    voting.state?.isComplete === true &&
    (voting.state?.winners.length ?? 0) > 1;

  const announced = useRef(false);
  useEffect(() => {
    if (decided && !announced.current) {
      announced.current = true;
      onDecided();
    }
  }, [decided, onDecided]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      setStatements(
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
      statements.find((s) => s.id === winningId) ??
      statements.find((s) => s.isSelected);
    return (
      <div className="py-6 fade-in">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">
          Your team's point of view
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Every HMW question builds on this.
        </p>
        <blockquote className="border-l-4 border-blue-500 bg-blue-50 rounded-r-lg p-5">
          <p className="text-gray-800">{winner?.content.statement}</p>
        </blockquote>
      </div>
    );
  }

  return (
    <div>
      <div key={inVoting ? 'vote' : 'write'} className="fade-in">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-gray-800">
            {inVoting
              ? 'Vote for the best POV statement'
              : 'Write your POV statement'}
          </h2>
          <span className="flex items-center gap-1.5 text-sm text-gray-500">
            <Users className="h-4 w-4" />
            {inVoting
              ? `${voting.state?.votedCount ?? 0} of ${memberCount} voted`
              : `${statements.length} of ${memberCount} submitted`}
          </span>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          {inVoting
            ? 'Statements are anonymous — vote for the one that best frames the challenge.'
            : 'Everyone writes one. The team then votes on which to use.'}
        </p>

        {inVoting ? (
          <p className="note note-good mb-5 flex items-center gap-2">
            <Vote className="h-4 w-4 shrink-0" />
            <span>
              <b>Voting is open.</b> Pick a statement below, then press Submit
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
          statements.length > 0 && (
            <p className="note mb-5 flex items-center gap-2 text-gray-600 bg-transparent border-gray-200">
              <Users className="h-4 w-4 shrink-0" />
              Waiting for everyone to submit — {statements.length} of{' '}
              {memberCount} so far.
            </p>
          )
        )}
      </div>

      {research && (
        <ResearchBrief needs={research.needs} insights={research.insights} />
      )}

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
          <label htmlFor="pov" className="sr-only">
            Your POV statement
          </label>
          <textarea
            id="pov"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={TEMPLATE}
            className="field"
          />

          <div className="note note-attention mt-3">
            <p className="font-semibold mb-1">Writing a POV that works</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Include all three: the user, their need, and your insight</li>
              <li>
                Make the need a <b>verb</b> — it keeps the statement actionable
              </li>
              <li>
                The insight should be something you learned, not just the reason
                for the need
              </li>
              <li>Hold a tension. Do not put a solution in the statement</li>
            </ul>
          </div>

          <div className="flex items-center justify-end gap-3 mt-3">
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
              {mine ? 'Update statement' : 'Submit statement'}
            </button>
          </div>
        </div>
      )}

      <ul className="space-y-3 stagger">
        {statements.map((statement) => {
          const votes = voting.state?.tally[statement.id] ?? 0;
          const isPicked = picked === statement.id;

          return (
            <li key={statement.id}>
              <button
                type="button"
                disabled={!inVoting}
                onClick={() => setPicked(statement.id)}
                aria-pressed={isPicked}
                className="selectable w-full p-4"
              >
                <div className="flex items-start gap-3">
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
                    {statement.content.statement}
                  </p>
                  {votes > 0 && (
                    <span className="shrink-0 text-xs bg-white border border-gray-200 text-gray-600 rounded-full px-2 py-0.5">
                      {votes}
                    </span>
                  )}
                </div>
                {statement.isMine && (
                  <p
                    className={`text-xs font-medium text-blue-600 mt-1 ${
                      inVoting ? 'ml-7' : ''
                    }`}
                  >
                    Your statement
                  </p>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {statements.length === 0 && (
        <p className="text-sm text-gray-400 py-4">
          Nobody has submitted a statement yet.
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
                  Pick a statement above first
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
