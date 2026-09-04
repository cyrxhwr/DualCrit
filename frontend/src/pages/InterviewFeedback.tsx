import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { api, type StoredEvaluation } from '../lib/api';
import { annotateTranscript } from '../lib/annotations';
import { scenarioByTag } from '../lib/scenarios';

interface Props {
  activityId: string;
  scenarioTag: string | null;
}

/** One colour per criterion, in rubric order, so the bars stay distinguishable. */
const BAR_COLOURS = [
  { bar: 'bg-blue-500', tint: 'bg-blue-50', text: 'text-blue-700' },
  { bar: 'bg-green-500', tint: 'bg-green-50', text: 'text-green-700' },
  { bar: 'bg-amber-500', tint: 'bg-amber-50', text: 'text-amber-700' },
  { bar: 'bg-violet-500', tint: 'bg-violet-50', text: 'text-violet-700' },
  { bar: 'bg-rose-500', tint: 'bg-rose-50', text: 'text-rose-700' },
];

/**
 * The student's own interview, scored against the rubric, with the moments
 * that earned those scores marked in the transcript itself.
 */
export default function InterviewFeedback({ activityId, scenarioTag }: Props) {
  const [evaluation, setEvaluation] = useState<StoredEvaluation | null>(null);
  const [messages, setMessages] = useState<
    { role: 'student' | 'persona'; text: string; at: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scenario = scenarioTag ? scenarioByTag(scenarioTag) : undefined;

  useEffect(() => {
    Promise.all([
      api.interviewFeedback(activityId),
      api.interviewState(activityId),
    ])
      .then(([feedbackResult, interview]) => {
        setEvaluation(feedbackResult.evaluation);
        setMessages(interview.messages);
        setError(null);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load feedback'),
      )
      .finally(() => setLoading(false));
  }, [activityId]);

  if (loading) {
    return (
      <p className="flex items-center justify-center gap-2 text-sm text-gray-500 py-12">
        <Sparkles className="h-4 w-4 animate-pulse" />
        Reading your interview…
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {error}
      </p>
    );
  }

  if (!evaluation) {
    return (
      <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
        AI feedback is not configured on this server, so your interview has no
        scores.
      </p>
    );
  }

  const criteria = evaluation.feedback.criteria ?? [];
  const annotated = annotateTranscript(
    messages,
    evaluation.feedback.annotations ?? [],
  );

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-1">
        Feedback on your interview
      </h2>
      <p className="text-sm text-gray-500 mb-5">
        Scored on how you followed up, not on the opening question your team
        chose. Highlights mark the moments behind the scores.
      </p>

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr] items-start">
        <aside className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Evaluation</h3>
          {criteria.map((criterion, i) => {
            const colour = BAR_COLOURS[i % BAR_COLOURS.length];
            const pct = Math.max(0, Math.min(100, (criterion.score / 5) * 100));

            return (
              <section
                key={criterion.standard}
                className={`${colour.tint} rounded-lg p-4`}
              >
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <h4 className="text-sm font-medium text-gray-800">
                    {criterion.standard}
                  </h4>
                  <span className={`text-sm font-bold ${colour.text}`}>
                    {criterion.score}
                    <span className="text-xs font-normal text-gray-500">/5</span>
                  </span>
                </div>
                <div className="h-1.5 bg-white/70 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full ${colour.bar} rounded-full`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className={`text-xs leading-relaxed ${colour.text}`}>
                  {criterion.response}
                </p>
              </section>
            );
          })}
        </aside>

        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
          {annotated.map((entry, i) => {
            const isStudent = entry.message.role === 'student';
            const notes = [
              ...entry.segments
                .map((s) => s.annotation)
                .filter((a): a is NonNullable<typeof a> => a !== null),
              ...entry.unanchored,
            ];

            return (
              <div
                key={i}
                className={`p-4 ${isStudent ? 'bg-white' : 'bg-gray-50'}`}
              >
                <div className="flex gap-3">
                  <span className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs bg-white border border-gray-200">
                    {isStudent ? '❓' : (scenario?.persona.image ?? '🙂')}
                  </span>
                  <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                    {entry.segments.map((segment, s) =>
                      segment.annotation ? (
                        <mark
                          key={s}
                          className={`rounded px-0.5 ${
                            segment.annotation.kind === 'issue'
                              ? 'bg-amber-200 text-amber-950'
                              : 'bg-green-200 text-green-950'
                          }`}
                        >
                          {segment.text}
                        </mark>
                      ) : (
                        <span key={s}>{segment.text}</span>
                      ),
                    )}
                  </p>
                </div>

                {notes.map((note, n) => (
                  <div
                    key={n}
                    className={`mt-2 ml-10 text-xs rounded-lg px-3 py-2 ${
                      note.kind === 'issue'
                        ? 'bg-amber-50 text-amber-900 border border-amber-200'
                        : 'bg-green-50 text-green-900 border border-green-200'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-medium mb-0.5">
                      {note.kind === 'issue' ? (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      {note.label}
                    </span>
                    {note.explanation}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
