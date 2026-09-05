import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { CheckCircle, Send, Users } from 'lucide-react';
import { api, type InterviewState } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useActivityRoom } from '../lib/useActivityRoom';
import { scenarioByTag } from '../lib/scenarios';
import PersonaBrief from '../components/PersonaBrief';

interface Props {
  activityId: string;
  onContinue: () => void;
}

/**
 * Each student interviews the persona themselves, using the question the team
 * chose as their opening.
 *
 * This is the first per-student step — the conversation belongs to one person,
 * unlike everything before it.
 */
export default function Interview({ activityId, onContinue }: Props) {
  const [state, setState] = useState<InterviewState | null>(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useActivityRoom(activityId);
  const scenario = state?.scenarioTag
    ? scenarioByTag(state.scenarioTag)
    : undefined;

  const loadProgress = useCallback(async () => {
    try {
      setProgress(await api.interviewProgress(activityId));
    } catch {
      // progress is informational; a failure here should not block the interview
    }
  }, [activityId]);

  useEffect(() => {
    api
      .interviewState(activityId)
      .then(setState)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load'),
      );
    void loadProgress();
  }, [activityId, loadProgress]);

  useEffect(() => {
    const socket = getSocket();
    const onProgress = (payload: { activityId: string }) => {
      if (payload.activityId === activityId) void loadProgress();
    };
    socket.on('interview:progress', onProgress);
    return () => {
      socket.off('interview:progress', onProgress);
    };
  }, [activityId, loadProgress]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state?.messages.length, busy]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      setState(await api.interviewAsk(activityId, text.trim()));
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send');
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      setProgress(await api.interviewComplete(activityId));
      setState((prev) => (prev ? { ...prev, completed: true } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish');
    } finally {
      setBusy(false);
    }
  };

  if (!state) {
    return <p className="text-gray-500 py-8 text-center">Loading…</p>;
  }

  const started = state.messages.length > 0;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-1">
        <h2 className="text-lg font-semibold text-gray-800">
          Interview {scenario?.persona.name ?? 'the persona'}
        </h2>
        <span className="flex items-center gap-1.5 text-sm text-gray-500 shrink-0">
          <Users className="h-4 w-4" />
          {progress.completed} of {progress.total} finished
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Ask your team’s question, then probe with three follow-ups.
      </p>

      {scenario && <PersonaBrief scenario={scenario} showPresence />}

      {error && <p className="note note-error mb-4">{error}</p>}

      {!started && (
        <div className="panel p-6 mb-6 slide-in-up">
          <p className="text-sm text-gray-600 mb-2">
            Your team's opening question
          </p>
          <blockquote className="border-l-4 border-blue-500 bg-blue-50 rounded-r-lg p-4 mb-4">
            <p className="text-gray-800">{state.openingQuestion}</p>
          </blockquote>
          <button
            type="button"
            disabled={busy || !state.openingQuestion}
            onClick={() => void send(state.openingQuestion ?? '')}
            className="btn btn-primary"
          >
            {busy ? 'Asking…' : 'Ask this question'}
          </button>
        </div>
      )}

      {started && (
        <div className="panel divide-y divide-gray-100 mb-4 max-h-[28rem] overflow-y-auto overflow-x-hidden custom-scrollbar">
          {state.messages.map((message, i) => (
            <div
              key={i}
              className={`p-4 flex gap-3 ${
                message.role === 'student' ? 'bg-white' : 'bg-gray-50'
              }`}
            >
              <span
                className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm ${
                  message.role === 'student'
                    ? 'bg-blue-100 text-blue-700 font-semibold text-xs'
                    : 'bg-white border border-gray-200'
                }`}
              >
                {message.role === 'student'
                  ? 'You'
                  : (scenario?.persona.image ?? '🙂')}
              </span>
              <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                {message.text}
              </p>
            </div>
          ))}

          {busy && (
            <p className="p-4 text-sm text-gray-400">
              {scenario?.persona.name ?? 'They'} is thinking…
            </p>
          )}
          <div ref={endRef} />
        </div>
      )}

      {started && !state.completed && (
        <>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void send(draft);
            }}
            className="flex gap-2"
          >
            <label htmlFor="followup" className="sr-only">
              Your follow-up question
            </label>
            <input
              id="followup"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={500}
              disabled={busy || state.followUpsLeft <= 0}
              placeholder={
                state.followUpsLeft > 0
                  ? 'Ask a follow-up…'
                  : 'You have used all three follow-ups'
              }
              className="field flex-1"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim() || state.followUpsLeft <= 0}
              className="btn btn-primary px-5"
            >
              <Send className="h-4 w-4" />
              Ask
            </button>
          </form>

          <div className="flex items-center justify-between gap-4 mt-3">
            <span className="text-xs text-gray-400">
              {state.followUpsLeft > 0
                ? `${state.followUpsLeft} follow-up${state.followUpsLeft === 1 ? '' : 's'} left`
                : 'All three follow-ups asked'}
            </span>
            <button
              type="button"
              onClick={() => void finish()}
              disabled={busy || state.followUpsLeft > 0}
              title={
                state.followUpsLeft > 0
                  ? 'Ask all three follow-ups first'
                  : undefined
              }
              className="btn btn-primary"
            >
              Finish interview
            </button>
          </div>
        </>
      )}

      {state.completed && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-blue-800">Interview finished</p>
            <p className="text-sm text-blue-700 mt-0.5">
              {progress.completed === progress.total
                ? 'Everyone is done — you can read how the rest of your team interviewed.'
                : `Waiting for the rest of your team — ${progress.completed} of ${progress.total} finished.`}
            </p>
          </div>

          {progress.completed === progress.total && (
            <button
              type="button"
              onClick={onContinue}
              className="btn btn-primary"
            >
              Read the team's interviews
            </button>
          )}
        </div>
      )}
    </div>
  );
}
