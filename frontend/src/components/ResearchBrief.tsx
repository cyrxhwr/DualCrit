interface Props {
  needs: string[];
  insights: string[];
  /** Shown once the team has chosen one, on the HMW steps. */
  pov?: string | null;
}

/**
 * The team's research, kept on screen through every POV and HMW step.
 *
 * Students are asked to build on these and are marked against them, so they
 * should never have to remember what they said or navigate back to find it.
 */
export default function ResearchBrief({ needs, insights, pov }: Props) {
  return (
    <section className="panel overflow-hidden mb-6">
      {pov && (
        <div className="p-5 border-b border-gray-900/[0.07]">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-1">
            Your team's point of view
          </h3>
          <p className="text-gray-800">{pov}</p>
        </div>
      )}

      <dl className="grid gap-5 md:grid-cols-2 bg-blue-50/40 p-5">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-1.5">
            Needs
          </dt>
          <dd>
            <ol className="space-y-1">
              {needs.map((need, i) => (
                <li key={i} className="text-sm text-gray-700 flex gap-2">
                  <span className="text-gray-400 tabular-nums">{i + 1}.</span>
                  <span>{need}</span>
                </li>
              ))}
            </ol>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-[#b9432a] mb-1.5">
            Insights
          </dt>
          <dd>
            <ol className="space-y-1">
              {insights.map((insight, i) => (
                <li key={i} className="text-sm text-gray-700 flex gap-2">
                  <span className="text-gray-400 tabular-nums">{i + 1}.</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ol>
          </dd>
        </div>
      </dl>
    </section>
  );
}
