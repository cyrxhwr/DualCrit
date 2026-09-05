import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  LogIn,
  MessageSquareText,
  SquarePen,
  Target,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import {
  api,
  ACTIVITY_TYPE_LABELS,
  type Activity,
  type ActivityType,
} from '../lib/api';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

type Panel = 'none' | 'create' | 'join';

export default function Dashboard() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>('none');
  const [name, setName] = useState('');
  const [type, setType] = useState<ActivityType>('interview');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setActivities(await api.listActivities());
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load activities',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createActivity = async () => {
    setBusy(true);
    setError(null);
    try {
      const activity = await api.createActivity(name.trim(), type);
      navigate(`/activity/${activity.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create it');
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const activity = await api.joinActivity(joinCode);
      navigate(`/activity/${activity.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join');
    } finally {
      setBusy(false);
    }
  };

  const typeOption = (
    value: ActivityType,
    Icon: typeof MessageSquareText,
    blurb: string,
    disabled = false,
  ) => {
    const selected = type === value;
    return (
      <button
        key={value}
        type="button"
        disabled={disabled}
        onClick={() => setType(value)}
        aria-pressed={selected}
        title={disabled ? 'Not available yet' : undefined}
        className={`relative flex-1 text-left rounded-xl border-2 p-4 transition-all ${
          disabled
            ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
            : selected
              ? 'border-violet-500 bg-violet-50 shadow-sm'
              : 'border-gray-200 hover:border-violet-300 hover:bg-violet-50/40'
        }`}
      >
        <Icon
          className={`h-5 w-5 mb-2 ${
            disabled
              ? 'text-gray-300'
              : selected
                ? 'text-violet-600'
                : 'text-gray-400'
          }`}
        />
        <span className="flex items-center gap-2 font-semibold text-gray-800">
          {ACTIVITY_TYPE_LABELS[value]}
          {disabled && (
            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500 bg-gray-200 rounded-full px-1.5 py-0.5">
              Soon
            </span>
          )}
        </span>
        <span className="block text-xs text-gray-500 mt-0.5">{blurb}</span>
      </button>
    );
  };

  return (
    <AppShell>
      <div className="card p-8 fade-in">
        <div className="grid sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
          <button
            type="button"
            onClick={() => setPanel(panel === 'create' ? 'none' : 'create')}
            aria-expanded={panel === 'create'}
            className={`smooth-hover rounded-2xl py-9 flex flex-col items-center gap-3 border-2 border-dashed transition-colors ${
              panel === 'create'
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50'
            }`}
          >
            <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/25">
              <SquarePen className="h-6 w-6" />
            </span>
            <span className="font-semibold text-emerald-900">
              Create activity
            </span>
          </button>

          <button
            type="button"
            onClick={() => setPanel(panel === 'join' ? 'none' : 'join')}
            aria-expanded={panel === 'join'}
            className={`smooth-hover rounded-2xl py-9 flex flex-col items-center gap-3 border-2 border-dashed transition-colors ${
              panel === 'join'
                ? 'border-orange-500 bg-orange-50'
                : 'border-orange-300 bg-orange-50/50 hover:bg-orange-50'
            }`}
          >
            <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 text-white flex items-center justify-center shadow-lg shadow-orange-600/25">
              <LogIn className="h-6 w-6" />
            </span>
            <span className="font-semibold text-orange-900">Join activity</span>
          </button>
        </div>

        {panel === 'create' && (
          <div className="max-w-2xl mx-auto mt-5 panel p-5 slide-in-up">
            <label
              htmlFor="activityName"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              Activity name
            </label>
            <input
              id="activityName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="Team HCI"
              className="field mb-5"
            />

            <p className="text-sm font-medium text-gray-700 mb-1">
              What will the team do?
            </p>
            <p className="text-xs text-gray-500 mb-3">Fixed once created.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              {typeOption(
                'interview',
                MessageSquareText,
                'Write questions, vote, then interview the persona',
              )}
              {typeOption(
                'pov_hmw',
                Target,
                'Needs and insights, POV statements, then HMW questions',
                true,
              )}
            </div>

            <div className="flex justify-end mt-5">
              <button
                type="button"
                onClick={createActivity}
                disabled={busy || name.trim().length === 0}
                className="btn btn-emerald"
              >
                {busy ? 'Creating…' : 'Create activity'}
              </button>
            </div>
          </div>
        )}

        {panel === 'join' && (
          <div className="max-w-2xl mx-auto mt-5 flex gap-2 slide-in-up">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="ABC123"
              aria-label="Join code"
              className="field flex-1 tracking-[0.35em] text-center font-mono uppercase text-lg"
            />
            <button
              type="button"
              onClick={join}
              disabled={busy || joinCode.length !== 6}
              className="btn btn-amber px-7"
            >
              Join
            </button>
          </div>
        )}

        {error && (
          <p className="max-w-2xl mx-auto mt-5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mt-10 mb-4">
          Activities
        </h2>

        {loading ? (
          <p className="text-center text-gray-500 py-8">Loading…</p>
        ) : activities.length === 0 ? (
          <p className="text-center text-gray-400 py-10">No activities yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger">
            {activities.map((activity) => (
              <article
                key={activity.id}
                className="panel smooth-hover p-5 flex flex-col"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-900">
                    {activity.name}
                  </h3>
                  <span
                    className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      activity.type === 'interview'
                        ? 'bg-violet-50 text-violet-700'
                        : 'bg-purple-50 text-purple-700'
                    }`}
                  >
                    {ACTIVITY_TYPE_LABELS[activity.type]}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1.5 line-clamp-2">
                  {activity.members.join(', ')}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {formatDate(activity.updatedAt)}
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/activity/${activity.id}`)}
                  className="btn btn-primary mt-4 w-full"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
