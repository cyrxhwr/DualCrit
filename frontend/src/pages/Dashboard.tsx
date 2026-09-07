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
              ? 'border-blue-500 bg-blue-50 shadow-sm'
              : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/40'
        }`}
      >
        <Icon
          className={`h-5 w-5 mb-2 ${
            disabled
              ? 'text-gray-300'
              : selected
                ? 'text-blue-600'
                : 'text-gray-400'
          }`}
        />
        <span className="flex items-center gap-2 font-semibold text-gray-800">
          {ACTIVITY_TYPE_LABELS[value]}
          {disabled && (
            <span className="badge badge-muted uppercase tracking-wide">
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
            className={`smooth-hover rounded-xl py-8 flex flex-col items-center gap-3 border border-dashed transition-colors ${
              panel === 'create'
                ? 'border-blue-600 bg-blue-50'
                : 'border-blue-200 bg-blue-50/50 hover:bg-blue-50'
            }`}
          >
            <span className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <SquarePen className="h-6 w-6" />
            </span>
            <span className="font-semibold text-blue-900">Create activity</span>
          </button>

          <button
            type="button"
            onClick={() => setPanel(panel === 'join' ? 'none' : 'join')}
            aria-expanded={panel === 'join'}
            className={`smooth-hover rounded-xl py-8 flex flex-col items-center gap-3 border border-dashed transition-colors ${
              panel === 'join'
                ? 'border-[#f0704f] bg-[#fef4f1]'
                : 'border-[#ffd0c3] bg-[#fef4f1]/60 hover:bg-[#fef4f1]'
            }`}
          >
            <span className="w-11 h-11 rounded-xl bg-[#f0704f] text-white flex items-center justify-center">
              <LogIn className="h-6 w-6" />
            </span>
            <span className="font-semibold text-[#b9432a]">Join activity</span>
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
              )}
            </div>

            <div className="flex justify-end mt-5">
              <button
                type="button"
                onClick={createActivity}
                disabled={busy || name.trim().length === 0}
                className="btn btn-primary"
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
              className="btn btn-accent px-7"
            >
              Join
            </button>
          </div>
        )}

        {error && (
          <p className="note note-error max-w-2xl mx-auto mt-5">{error}</p>
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
                  <span className="badge badge-brand shrink-0">
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
                  {activity.currentStep === 'summary'
                    ? 'See results'
                    : 'Continue'}
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
