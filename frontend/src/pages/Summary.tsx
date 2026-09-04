import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, Copy, Download, Star } from 'lucide-react';
import { api, type SessionSummary } from '../lib/api';
import { scenarioByTag } from '../lib/scenarios';
import { describeMistake, isNoIssue } from '../lib/rubric';

interface Props {
  activityId: string;
  onFinish: () => void;
}

/** The model writes the `**markers**` itself, so this is a plain parse. */
function withEmphasis(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/**
 * Everything the student produced, in one place.
 *
 * Assembled from stored rows rather than regenerated, so it matches what they
 * were shown at each step.
 */
export default function Summary({ activityId, onFinish }: Props) {
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .sessionSummary(activityId)
      .then(setSummary)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load summary'),
      );
  }, [activityId]);

  const copy = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary.summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('Your browser would not let the page copy to the clipboard');
    }
  };

  const download = () => {
    if (!summary) return;
    const blob = new Blob([summary.summaryText], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${summary.activityName.replace(/[^\w-]+/g, '-')}-summary.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (error && !summary) {
    return (
      <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {error}
      </p>
    );
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
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void copy()}
            className="flex items-center gap-1.5 text-sm border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={download}
            className="flex items-center gap-1.5 text-sm border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>
      </div>
      {scenario && (
        <p className="text-sm text-gray-500 mb-5">
          You interviewed {scenario.persona.name},{' '}
          {scenario.persona.role.toLowerCase()}.
        </p>
      )}

      {!summary.saved && (
        <p className="mb-5 flex items-start gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
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
            <p className="border border-gray-200 rounded-lg p-4 text-gray-800">
              {summary.myQuestion}
            </p>
          </section>
        )}

        {summary.teamQuestion && (
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              The question your team chose
            </h3>
            <blockquote className="border-l-4 border-violet-500 bg-violet-50 rounded-r-lg p-4 text-gray-800">
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
              <p className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
                No rubric issues were found.
                {summary.questionFeedback[0]?.explanation
                  ? ` ${summary.questionFeedback[0].explanation}`
                  : ''}
              </p>
            ) : (
              <ul className="space-y-2">
                {issues.map((item, i) => (
                  <li
                    key={i}
                    className="border border-amber-200 bg-amber-50 rounded-lg p-4"
                  >
                    <p className="text-sm font-medium text-amber-900">
                      {item.mistake}
                    </p>
                    {describeMistake(item.mistake) && (
                      <p className="text-xs text-amber-800 mt-0.5">
                        {describeMistake(item.mistake)}
                      </p>
                    )}
                    <p className="text-sm text-amber-900 mt-2">
                      {item.explanation}
                    </p>
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
            <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 bg-white">
              {summary.transcript.map((message, i) => (
                <div
                  key={i}
                  className={`p-4 flex gap-3 ${
                    message.role === 'student' ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  <span className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs bg-white border border-gray-200">
                    {message.role === 'student'
                      ? '❓'
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
                <article
                  key={criterion.standard}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h4 className="font-semibold text-gray-800">
                      {criterion.standard}
                    </h4>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-emerald-600">
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
                                ? 'text-yellow-400 fill-current'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </span>
                    </span>
                  </div>
                  <p className="text-sm text-emerald-900 bg-emerald-50 rounded p-3 leading-relaxed">
                    {withEmphasis(criterion.response)}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="flex justify-end mt-8">
        <button
          type="button"
          onClick={onFinish}
          className="bg-teal-600 text-white rounded-lg px-8 py-2.5 text-sm font-semibold hover:bg-teal-700 btn-lift shadow-sm"
        >
          Back to my activities
        </button>
      </div>
    </div>
  );
}
