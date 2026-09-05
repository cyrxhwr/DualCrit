import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import { api, type TeamTranscripts } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useActivityRoom } from '../lib/useActivityRoom';
import { scenarioByTag } from '../lib/scenarios';

interface Props {
  activityId: string;
  scenarioTag: string | null;
  onContinue: () => void;
}

/**
 * Read how the rest of the team interviewed the same persona.
 *
 * Comparison is the point: everyone opened with the same question, so the
 * differences are entirely in how each person followed up.
 */
export default function PeerReview({
  activityId,
  scenarioTag,
  onContinue,
}: Props) {
  const [data, setData] = useState<TeamTranscripts | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useActivityRoom(activityId);
  const scenario = scenarioTag ? scenarioByTag(scenarioTag) : undefined;

  const load = useCallback(async () => {
    try {
      const result = await api.teamTranscripts(activityId);
      setData(result);
      // Open your own by default; the others are a deliberate click.
      setOpen((prev) =>
        Object.keys(prev).length > 0
          ? prev
          : Object.fromEntries(
              result.transcripts.map((t) => [t.studentUuid, t.isMine]),
            ),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load');
    }
  }, [activityId]);

  useEffect(() => {
    void load();
  }, [load]);

  // The last team-mate finishing is what makes this readable.
  useEffect(() => {
    const socket = getSocket();
    const onProgress = (payload: { activityId: string }) => {
      if (payload.activityId === activityId) void load();
    };
    socket.on('interview:progress', onProgress);
    return () => {
      socket.off('interview:progress', onProgress);
    };
  }, [activityId, load]);

  if (error) {
    return (
      <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {error}
      </p>
    );
  }

  if (!data) {
    return <p className="text-gray-500 py-8 text-center">Loading…</p>;
  }

  if (!data.ready) {
    return (
      <div className="py-10 text-center fade-in">
        <Users className="h-8 w-8 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-800">
          Waiting for your team
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {data.completed} of {data.total} have finished their interview.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-1">
        How your team interviewed {scenario?.persona.name ?? 'the persona'}
      </h2>
      <p className="text-sm text-gray-500 mb-5">
        Everyone opened with the same question — the difference is in the
        follow-ups.
      </p>

      <div className="space-y-3 stagger">
        {data.transcripts.map((transcript) => {
          const isOpen = open[transcript.studentUuid] ?? false;
          const followUps = Math.max(
            0,
            transcript.messages.filter((m) => m.role === 'student').length - 1,
          );

          return (
            <article
              key={transcript.studentUuid}
              className="panel overflow-hidden"
            >
              <button
                type="button"
                onClick={() =>
                  setOpen((prev) => ({
                    ...prev,
                    [transcript.studentUuid]: !isOpen,
                  }))
                }
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-gray-50"
              >
                <span className="flex items-center gap-2 font-medium text-gray-800">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                  {transcript.authorName}
                  {transcript.isMine && (
                    <span className="text-[10px] uppercase tracking-wide bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                      You
                    </span>
                  )}
                </span>
                <span className="text-xs text-gray-400 shrink-0">
                  {followUps} follow-up{followUps === 1 ? '' : 's'}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 divide-y divide-gray-100">
                  {transcript.messages.map((message, i) => (
                    <div
                      key={i}
                      className={`p-4 flex gap-3 ${
                        message.role === 'student' ? 'bg-white' : 'bg-gray-50'
                      }`}
                    >
                      <span className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm bg-white border border-gray-200">
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
              )}
            </article>
          );
        })}
      </div>
      <div className="flex justify-end mt-8">
        <button type="button" onClick={onContinue} className="btn btn-primary">
          See my feedback
        </button>
      </div>
    </div>
  );
}
