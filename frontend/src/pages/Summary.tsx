import { useEffect, useState } from 'react';
import { AlertTriangle, Star } from 'lucide-react';
import { api, type SessionSummary } from '../lib/api';
import { scenarioByTag } from '../lib/scenarios';
import { describeMistake, isNoIssue } from '../lib/rubric';
import { withEmphasis } from '../lib/emphasis';
import NextStep from '../components/NextStep';
import { initialOf } from '../lib/name';
import { useAuth } from '../lib/auth';
import SummaryActions from '../components/SummaryActions';

interface Props {
  activityId: string;
  onFinish: () => void;
}

/**
 * Everything the student produced, in one place.
 *
 * Assembled from stored rows rather than regenerated, so it matches what they
 * were shown at each step.
 */
export default function Summary({ activityId, onFinish }: Props) {
  const { student } = useAuth();
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .sessionSummary(activityId)
      .then(setSummary)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load summary'),
      );
  }, [activityId]);

  if (error && !summary) {
    return <p className="note note-error">{error}</p>;
  }

  if (!summary) {
    return <p className="text-gray-500 py-8 text-center">Loading…</p>;
  }

  const scenario = summary.scenarioTag
    ? scenarioByTag(summary.scenarioTag)
    : undefined;
  const issues = summary.questionFeedback.filter((f) => !isNoIssue(f.mistake));

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-1">
        <h2 className="text-lg font-semibold text-gray-800">
          Your session summary
        </h2>
        <SummaryActions
          text={summary.summaryText}
          activityName={summary.activityName}
          onError={setError}
        />
      </div>
      {scenario && (
        <p className="text-sm text-gray-500 mb-5">
          You interviewed {scenario.persona.name},{' '}
          {scenario.persona.role.toLowerCase()}.
        </p>
      )}

      {!summary.saved && (
        <p className="note note-attention mb-5 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          This could not be saved to your record. Download a copy and tell your
          instructor.
        </p>
      )}

      <div className="space-y-6 stagger">
        {summary.myQuestion && (
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              The question you wrote
            </h3>
            <p className="panel p-4 text-gray-800">{summary.myQuestion}</p>
          </section>
        )}

        {summary.teamQuestion && (
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              The question your team chose
            </h3>
            <blockquote className="border-l-4 border-blue-500 bg-blue-50 rounded-r-lg p-4 text-gray-800">
              {summary.teamQuestion}
            </blockquote>
          </section>
        )}

        {summary.questionFeedback.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Feedback on the team question
            </h3>
            {issues.length === 0 ? (
              <p className="note note-good p-4">
                No rubric issues were found.{' '}
                {withEmphasis(summary.questionFeedback[0]?.explanation ?? '')}
              </p>
            ) : (
              <ul className="space-y-2">
                {issues.map((item, i) => (
                  <li key={i} className="note note-attention p-4">
                    <p className="text-sm font-semibold">{item.mistake}</p>
                    {describeMistake(item.mistake) && (
                      <p className="text-xs opacity-80 mt-0.5">
                        {describeMistake(item.mistake)}
                      </p>
                    )}
                    <p className="text-sm mt-2">
                      {withEmphasis(item.explanation)}
                    </p>
                    <NextStep text={item.nextStep} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {summary.transcript.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Your interview
              <span className="font-normal text-gray-400">
                {' '}
                · {summary.questionCount} question
                {summary.questionCount === 1 ? '' : 's'} asked
              </span>
            </h3>
            <div className="panel divide-y divide-gray-100 overflow-hidden">
              {summary.transcript.map((message, i) => (
                <div
                  key={i}
                  className={`p-4 flex gap-3 ${
                    message.role === 'student' ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs ${
                      message.role === 'student'
                        ? 'bg-blue-100 text-blue-700 font-semibold'
                        : 'bg-white border border-gray-200'
                    }`}
                  >
                    {message.role === 'student'
                      ? initialOf(student?.fullName)
                      : (scenario?.persona.image ?? '🙂')}
                  </span>
                  <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                    {message.text}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {summary.criteria.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Feedback on your interview
            </h3>
            <div className="space-y-3">
              {summary.criteria.map((criterion) => (
                <article key={criterion.standard} className="panel p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h4 className="font-semibold text-gray-800">
                      {criterion.standard}
                    </h4>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-blue-600">
                        {criterion.score}
                        <span className="text-xs font-normal text-gray-500">
                          /5
                        </span>
                      </span>
                      <span
                        className="flex"
                        aria-label={`${criterion.score} out of 5`}
                      >
                        {[0, 1, 2, 3, 4].map((i) => (
                          <Star
                            key={i}
                            aria-hidden="true"
                            className={`w-3.5 h-3.5 ${
                              i < Math.round(criterion.score)
                                ? 'text-[#f0704f] fill-current'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </span>
                    </span>
                  </div>
                  <p className="text-sm text-blue-900 bg-blue-50 rounded p-3 leading-relaxed">
                    {withEmphasis(criterion.response)}
                  </p>
                  <NextStep text={criterion.nextStep} />
                </article>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="flex justify-end mt-8">
        <button type="button" onClick={onFinish} className="btn btn-primary">
          Back to my activities
        </button>
      </div>
    </div>
  );
}
