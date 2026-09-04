import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AppShell from '../components/AppShell';
import { api, ACTIVITY_TYPE_LABELS, type Activity } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useActivityMembers } from '../lib/useActivityMembers';
import ScenarioSelection from './ScenarioSelection';
import QuestionCreation from './QuestionCreation';
import QuestionFeedback from './QuestionFeedback';
import Interview from './Interview';
import PeerReview from './PeerReview';
import InterviewFeedback from './InterviewFeedback';

type Step =
  | 'lobby'
  | 'scenario'
  | 'question'
  | 'feedback'
  | 'interview'
  | 'peer-review'
  | 'my-feedback';

/**
 * Which step to show.
 *
 * Derived from what the team has actually finished, not from anything held in
 * this component — so a reload, or opening the activity on another machine,
 * lands in the same place. `current_step` only decides whether this student
 * has left the lobby yet.
 */
function deriveStep(activity: Activity | null): Step {
  if (!activity) return 'lobby';
  // The team is in the lobby until the host starts. After that everyone moves
  // together, because the step follows what the team has finished rather than
  // anything held on one student's screen.
  if (!activity.startedAt) return 'lobby';
  if (!activity.selectedScenarioTag) return 'scenario';
  if (!activity.selectedQuestionContent) return 'question';
  // From here the workflow is per student, so it follows their own recorded
  // step rather than anything the team has finished.
  if (activity.currentStep === 'my-feedback') return 'my-feedback';
  if (activity.currentStep === 'peer-review') return 'peer-review';
  if (activity.currentStep === 'interview') return 'interview';
  return 'feedback';
}

export default function ActivityRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { members, connected } = useActivityMembers(id);

  const loadActivity = useCallback(async () => {
    if (!id) return;
    try {
      const all = await api.listActivities();
      const found = all.find((a) => a.id === id);
      if (!found) {
        setError('That activity is not one of yours.');
        return;
      }
      setActivity(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load it');
    }
  }, [id]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  // A completed vote writes the team's choice onto the activity, which is what
  // moves everyone to the next step.
  useEffect(() => {
    if (!id) return;
    const socket = getSocket();
    const onUpdated = (payload: { activityId: string }) => {
      if (payload.activityId === id) void loadActivity();
    };
    socket.on('activity:updated', onUpdated);
    return () => {
      socket.off('activity:updated', onUpdated);
    };
  }, [id, loadActivity]);

  const step = deriveStep(activity);

  const [starting, setStarting] = useState(false);

  const goToStep = async (step: string) => {
    if (!id) return;
    await api.setStep(id, step).catch(() => undefined);
    await loadActivity();
  };

  const begin = async () => {
    if (!id) return;
    setStarting(true);
    try {
      await api.startActivity(id);
      await loadActivity();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start');
    } finally {
      setStarting(false);
    }
  };

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

        {activity && step === 'scenario' && id && (
          <ScenarioSelection activityId={id} onDecided={() => void loadActivity()} />
        )}

        {activity && step === 'question' && id && (
          <QuestionCreation
            activityId={id}
            scenarioTag={activity.selectedScenarioTag}
          />
        )}

        {activity && step === 'feedback' && id && activity.selectedQuestionContent && (
          <QuestionFeedback
            activityId={id}
            question={activity.selectedQuestionContent}
            onContinue={() => void goToStep('interview')}
          />
        )}

        {activity && step === 'interview' && id && (
          <Interview
            activityId={id}
            onContinue={() => void goToStep('peer-review')}
          />
        )}

        {activity && step === 'peer-review' && id && (
          <PeerReview
            activityId={id}
            scenarioTag={activity.selectedScenarioTag}
            onContinue={() => void goToStep('my-feedback')}
          />
        )}

        {activity && step === 'my-feedback' && id && (
          <InterviewFeedback activityId={id} />
        )}

        {activity && step === 'lobby' && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <h1 className="text-xl font-semibold text-gray-800">
                {activity.name}
              </h1>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full ${
                  activity.type === 'interview'
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-purple-50 text-purple-700'
                }`}
              >
                {ACTIVITY_TYPE_LABELS[activity.type]}
              </span>
            </div>

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
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm text-gray-600">
                    Members ({members.length})
                  </h2>
                  <span
                    className="flex items-center gap-1.5 text-[11px] text-gray-400"
                    title={
                      connected
                        ? 'Updating as people join'
                        : 'Reconnecting — the list may be out of date'
                    }
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        connected ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                    {connected ? 'Live' : 'Offline'}
                  </span>
                </div>

                <ul className="space-y-2">
                  {members.map((member) => (
                    <li
                      key={member.studentUuid}
                      className="bg-blue-100 text-blue-800 text-sm rounded px-3 py-2 flex items-center justify-between gap-2"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            member.isOnline ? 'bg-green-500' : 'bg-blue-300'
                          }`}
                          title={member.isOnline ? 'In the room' : 'Away'}
                        />
                        {member.fullName}
                      </span>
                      {member.isHost && (
                        <span className="text-[10px] uppercase tracking-wide text-blue-500">
                          Host
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                {members.length === 0 && (
                  <p className="text-sm text-gray-400 py-2">
                    Waiting for the member list…
                  </p>
                )}
              </section>
            </div>

            <div className="max-w-3xl flex items-center justify-between gap-4 mt-6">
              <p className="text-xs text-gray-500">
                {activity.isHost
                  ? 'Starting locks the team — nobody can join after this.'
                  : 'Waiting for the host to start. Anyone still joining should do it now.'}
              </p>

              {activity.isHost && (
                <button
                  type="button"
                  onClick={() => void begin()}
                  disabled={starting || activity.type !== 'interview'}
                  title={
                    activity.type === 'interview'
                      ? undefined
                      : 'The POV & HMW workflow is not built yet'
                  }
                  className="shrink-0 bg-green-600 text-white rounded px-6 py-1.5 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {starting ? 'Starting…' : 'Start activity'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
