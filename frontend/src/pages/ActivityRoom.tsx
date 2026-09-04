import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AppShell from '../components/AppShell';
import { api, type Activity } from '../lib/api';

/**
 * The lobby from the mockup: join code on the left, members on the right.
 *
 * The workflow steps (scenario vote, question creation, interview, feedback)
 * mount from here as they are built.
 */
export default function ActivityRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .listActivities()
      .then((all) => {
        const found = all.find((a) => a.id === id);
        if (!found) {
          setError('That activity is not one of yours.');
          return;
        }
        setActivity(found);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load it'),
      );
  }, [id]);

  return (
    <AppShell>
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </button>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {activity && (
          <>
            <h1 className="text-xl font-semibold text-gray-800 mb-6">
              {activity.name}
            </h1>

            <div className="grid gap-6 md:grid-cols-[1fr_1.2fr] max-w-3xl">
              <section className="border border-gray-200 rounded-lg p-5">
                <h2 className="text-sm text-gray-600 mb-3">Join Code</h2>
                <p className="border-2 border-dashed border-blue-400 bg-blue-50 rounded-lg py-5 text-center text-3xl font-semibold tracking-[0.2em] text-blue-800">
                  {activity.code}
                </p>
                <p className="text-[11px] text-gray-400 italic mt-3">
                  Share this code with your groupmates so they can join.
                </p>
              </section>

              <section className="border border-gray-200 rounded-lg p-5">
                <h2 className="text-sm text-gray-600 mb-3">
                  Members ({activity.members.length})
                </h2>
                <ul className="space-y-2">
                  {activity.members.map((name, i) => (
                    <li
                      key={`${name}-${i}`}
                      className="bg-blue-100 text-blue-800 text-sm rounded px-3 py-2 text-center"
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="max-w-3xl flex justify-end mt-6">
              <button
                type="button"
                className="bg-green-600 text-white rounded px-6 py-1.5 text-sm font-medium hover:bg-green-700"
              >
                Continue
              </button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
