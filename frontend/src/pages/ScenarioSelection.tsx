import { useEffect, useState } from 'react';
import { Check, Users } from 'lucide-react';
import { SCENARIOS, scenarioByTag } from '../lib/scenarios';
import { useVoting } from '../lib/useVoting';

interface Props {
  activityId: string;
  onDecided: (tag: string) => void;
}

/**
 * The team votes on one persona/scenario pair.
 *
 * Voting is started from an effect, which is only safe because the server
 * treats start as "ensure a round exists" rather than "reset the round".
 */
export default function ScenarioSelection({ activityId, onDecided }: Props) {
  const { state, myVote, loading, error, start, castVote } = useVoting(
    activityId,
    'scenario_selection',
  );
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !state) void start(1);
  }, [loading, state, start]);

  useEffect(() => {
    if (myVote.length > 0) setPicked(myVote[0]);
  }, [myVote]);

  const decided = state?.status === 'completed' && state.winners.length === 1;

  useEffect(() => {
    if (decided && state) onDecided(state.winners[0]);
  }, [decided, state, onDecided]);

  if (loading) {
    return <p className="text-gray-500 py-8 text-center">Loading…</p>;
  }

  const hasVoted = myVote.length > 0;
  const tied =
    state?.isComplete === true && (state?.winners.length ?? 0) > 1;

  if (decided && state) {
    const winner = scenarioByTag(state.winners[0]);
    return (
      <div className="text-center py-8">
        <p className="text-5xl mb-3">{winner?.persona.image}</p>
        <h2 className="text-lg font-semibold text-gray-800">
          The team chose {winner?.persona.name}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{winner?.persona.role}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-gray-800">
          Choose a scenario together
        </h2>
        {state && (
          <span className="flex items-center gap-1.5 text-sm text-gray-500">
            <Users className="h-4 w-4" />
            {state.votedCount} of {state.memberCount} voted
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Everyone votes. The scenario with the most votes becomes the one your
        team interviews.
      </p>

      {tied && (
        <p className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          It's a tie. Change a vote to break it — nothing is decided until one
          scenario is ahead.
        </p>
      )}

      {error && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {SCENARIOS.map((scenario) => {
          const votes = state?.tally[scenario.tag] ?? 0;
          const isPicked = picked === scenario.tag;

          return (
            <button
              key={scenario.tag}
              type="button"
              onClick={() => setPicked(scenario.tag)}
              aria-pressed={isPicked}
              className={`text-left rounded-xl border-2 p-5 transition-colors ${
                isPicked
                  ? 'border-violet-500 bg-violet-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-3xl leading-none">
                  {scenario.persona.image}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-gray-800">
                      {scenario.persona.name}
                    </h3>
                    {votes > 0 && (
                      <span className="shrink-0 text-xs bg-white border border-gray-200 text-gray-600 rounded-full px-2 py-0.5">
                        {votes} {votes === 1 ? 'vote' : 'votes'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {scenario.persona.role}
                  </p>
                  <p className="text-sm text-gray-700 mt-2">
                    {scenario.scenario}
                  </p>
                  <p className="text-sm text-violet-700 mt-2 font-medium">
                    {scenario.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-3 mt-6">
        {hasVoted && (
          <span className="flex items-center gap-1.5 text-sm text-green-700">
            <Check className="h-4 w-4" />
            Vote saved
          </span>
        )}
        <button
          type="button"
          disabled={!picked || picked === myVote[0]}
          onClick={() => picked && void castVote([picked])}
          className="bg-green-600 text-white rounded px-6 py-1.5 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {hasVoted ? 'Change vote' : 'Submit vote'}
        </button>
      </div>
    </div>
  );
}
