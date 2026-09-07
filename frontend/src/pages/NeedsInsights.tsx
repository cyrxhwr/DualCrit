import { useCallback, useEffect, useState } from 'react';
import { Check, Clock, Crown, Target, Lightbulb } from 'lucide-react';
import { api, type PovHmwData } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useActivityRoom } from '../lib/useActivityRoom';

interface Props {
  activityId: string;
  isHost: boolean;
  onDone: () => void;
}

const COUNT = 3;

/**
 * The team's needs and insights, recorded by the host.
 *
 * The one step in the app that is deliberately not per-student: the team
 * agrees on these out loud and the host types them, carried over from the
 * previous system. The server enforces it too, so a member cannot post them
 * by going around the UI.
 */
export default function NeedsInsights({ activityId, isHost, onDone }: Props) {
  const [needs, setNeeds] = useState<string[]>(Array(COUNT).fill(''));
  const [insights, setInsights] = useState<string[]>(Array(COUNT).fill(''));
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connected = useActivityRoom(activityId);

  const load = useCallback(async () => {
    try {
      const data = await api.povHmwData(activityId);
      apply(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load');
    }
  }, [activityId]);

  const apply = (data: PovHmwData) => {
    if (!data.isSet) return;
    setNeeds([...data.needs, ...Array(COUNT).fill('')].slice(0, COUNT));
    setInsights([...data.insights, ...Array(COUNT).fill('')].slice(0, COUNT));
    setSaved(true);
  };

  useEffect(() => {
    void load();
  }, [load]);

  // A broadcast missed while the socket was down would leave a member on the
  // waiting screen after the host had already moved on.
  useEffect(() => {
    if (connected) void load();
  }, [connected, load]);

  useEffect(() => {
    const socket = getSocket();
    const onSet = (payload: PovHmwData & { activityId: string }) => {
      if (payload.activityId === activityId) apply(payload);
    };
    socket.on('pov-hmw:needs_insights', onSet);
    return () => {
      socket.off('pov-hmw:needs_insights', onSet);
    };
  }, [activityId]);

  const filledNeeds = needs.filter((n) => n.trim()).length;
  const filledInsights = insights.filter((i) => i.trim()).length;
  const complete = filledNeeds === COUNT && filledInsights === COUNT;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      apply(await api.setNeedsInsights(activityId, needs, insights));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const column = (
    label: string,
    hint: string,
    Icon: typeof Target,
    values: string[],
    setValues: (v: string[]) => void,
    filled: number,
    tone: 'brand' | 'accent',
  ) => (
    <section className="panel p-5">
      <div className="flex items-center justify-between mb-1">
        <h3
          className={`flex items-center gap-2 font-semibold ${
            tone === 'brand' ? 'text-blue-700' : 'text-[#b9432a]'
          }`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </h3>
        <span className="text-xs text-gray-500">
          {filled}/{COUNT}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-4">{hint}</p>

      <div className="space-y-2.5">
        {values.map((value, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span
              className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                tone === 'brand'
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-[#fef4f1] text-[#b9432a]'
              }`}
            >
              {i + 1}
            </span>
            {isHost && !saved ? (
              <input
                value={value}
                onChange={(e) => {
                  const next = [...values];
                  next[i] = e.target.value;
                  setValues(next);
                }}
                maxLength={300}
                placeholder={`${label.replace(/s$/, '')} ${i + 1}…`}
                className="field"
                aria-label={`${label} ${i + 1}`}
              />
            ) : (
              <p className="flex-1 text-sm text-gray-800 py-1.5">
                {value || <span className="text-gray-400">—</span>}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-gray-800">
          Needs and insights
        </h2>
        {isHost && (
          <span className="badge badge-brand">
            <Crown className="h-3 w-3" />
            You are the host
          </span>
        )}
      </div>

      <p className="text-sm text-gray-500 mb-5">
        {isHost
          ? 'Agree on these as a team, then record them. They are what every POV statement will be judged against.'
          : 'Your host records these for the team. They are what every POV statement will be judged against.'}
      </p>

      {error && <p className="note note-error mb-4">{error}</p>}

      {saved ? (
        <p className="note note-good mb-5 flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0" />
          <span>
            <b>Recorded.</b> Everyone can see them now.
          </span>
        </p>
      ) : isHost ? (
        <p className="note note-good mb-5 flex items-center gap-2">
          <Crown className="h-4 w-4 shrink-0" />
          <span>
            <b>Only you can fill these in.</b> Your team is waiting on this
            screen until you save.
          </span>
        </p>
      ) : (
        <p className="note mb-5 flex items-center gap-2 text-gray-600 bg-transparent border-gray-200">
          <Clock className="h-4 w-4 shrink-0 animate-pulse" />
          Waiting for the host to record the team's needs and insights…
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {column(
          'Needs',
          'What are the core needs your users are trying to fulfil?',
          Target,
          needs,
          setNeeds,
          filledNeeds,
          'brand',
        )}
        {column(
          'Insights',
          "What have you discovered about your users' behaviour and motivations?",
          Lightbulb,
          insights,
          setInsights,
          filledInsights,
          'accent',
        )}
      </div>

      <div className="flex items-center justify-end gap-3 mt-6">
        {isHost && !saved && !complete && (
          <span className="text-sm text-gray-500">
            Fill in all {COUNT * 2} first
          </span>
        )}
        {isHost && !saved && (
          <button
            type="button"
            onClick={save}
            disabled={busy || !complete}
            className="btn btn-primary"
          >
            {busy ? 'Saving…' : 'Record for the team'}
          </button>
        )}
        {saved && (
          <button type="button" onClick={onDone} className="btn btn-primary">
            Write POV statements
          </button>
        )}
      </div>
    </div>
  );
}
