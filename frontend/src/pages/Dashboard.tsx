import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, SquarePen } from 'lucide-react';
import AppShell from '../components/AppShell';
import { api, type Activity } from '../lib/api';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setActivities(await api.listActivities());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load activities');
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
      const activity = await api.createActivity('New Activity');
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

  return (
    <AppShell>
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <button
            type="button"
            onClick={createActivity}
            disabled={busy}
            className="border-2 border-dashed border-green-400 bg-green-50 rounded-xl py-10 flex flex-col items-center gap-3 hover:bg-green-100 disabled:opacity-60"
          >
            <SquarePen className="h-8 w-8 text-green-700" />
            <span className="font-medium text-green-800 text-center leading-tight">
              Create New
              <br />
              Activity
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowJoin((v) => !v)}
            className="border-2 border-dashed border-orange-400 bg-orange-50 rounded-xl py-10 flex flex-col items-center gap-3 hover:bg-orange-100"
          >
            <LogIn className="h-8 w-8 text-orange-600" />
            <span className="font-medium text-orange-800 text-center leading-tight">
              Join
              <br />
              Activity
            </span>
          </button>
        </div>

        {showJoin && (
          <div className="max-w-2xl mx-auto mt-6 flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="ABC123"
              aria-label="Join code"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg tracking-[0.3em] text-center font-mono uppercase focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <button
              type="button"
              onClick={join}
              disabled={busy || joinCode.length !== 6}
              className="bg-orange-500 text-white rounded-lg px-5 font-medium hover:bg-orange-600 disabled:opacity-50"
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

        <h2 className="text-xl font-semibold text-center text-gray-800 mt-10 mb-5">
          Activities
        </h2>

        {loading ? (
          <p className="text-center text-gray-500 py-8">Loading…</p>
        ) : activities.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            Nothing yet. Create an activity, or join one with a code from a
            groupmate.
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {activities.map((activity) => (
              <article
                key={activity.id}
                className="border border-gray-200 rounded-lg p-4 flex flex-col"
              >
                <h3 className="font-semibold text-gray-800">{activity.name}</h3>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  {activity.members.join(', ')}
                </p>
                <p className="text-sm text-gray-400 italic mt-1">
                  {formatDate(activity.updatedAt)}
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/activity/${activity.id}`)}
                  className="mt-4 self-center bg-green-600 text-white rounded px-6 py-1.5 text-sm font-medium hover:bg-green-700"
                >
                  Continue
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
