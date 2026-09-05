import type { Scenario } from '../lib/scenarios';

interface Props {
  scenario: Scenario;
  /** Shown on the interview screen, where the persona is actually replying. */
  showPresence?: boolean;
}

/**
 * The persona and scenario the team voted for, carried over from the previous
 * system: students need it in front of them while writing a question and
 * while interviewing, not only on the screen where they picked it.
 */
export default function PersonaBrief({ scenario, showPresence }: Props) {
  return (
    <section className="panel overflow-hidden mb-6">
      <div className="flex items-start gap-4 p-5">
        <span className="text-4xl leading-none shrink-0">
          {scenario.persona.image}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-gray-900">{scenario.persona.name}</h3>
          <p className="text-sm font-medium text-blue-600">
            {scenario.persona.role}
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mt-1.5">
            {scenario.persona.description}
          </p>
        </div>
        {showPresence && (
          <span className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-blue-600">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Online
          </span>
        )}
      </div>

      <dl className="border-t border-gray-900/[0.07] bg-blue-50/40 p-5 space-y-3">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Interview goal
          </dt>
          <dd className="text-sm text-gray-700 leading-relaxed mt-0.5">
            {scenario.description}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Context
          </dt>
          <dd className="text-sm text-gray-700 leading-relaxed mt-0.5">
            {scenario.context}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Sample scenario
          </dt>
          <dd className="text-sm text-gray-700 leading-relaxed mt-0.5">
            {scenario.scenario}
          </dd>
        </div>
      </dl>
    </section>
  );
}
