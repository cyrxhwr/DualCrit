import { Lightbulb } from 'lucide-react';

/**
 * The d.school's ten ways to open an HMW question.
 *
 * Reproduced with their own worked examples, which all come from one POV — a
 * mother moving through an airport with young children. Keeping the examples
 * together on a single scenario is what makes the ten read as ten different
 * moves rather than ten different topics, so they are not rewritten to match
 * whatever the team is working on.
 */
const TYPES: [string, string][] = [
  [
    'Amp up the good',
    'HMW use the kids’ energy to entertain fellow passengers?',
  ],
  ['Remove the bad', 'HMW separate the kids from fellow passengers?'],
  [
    'Explore the opposite',
    'HMW make the wait the most exciting part of the trip?',
  ],
  [
    'Question an assumption',
    'HMW entirely remove the wait time at the airport?',
  ],
  ['Go after adjectives', 'HMW make the rush refreshing instead of harrying?'],
  [
    'ID unexpected resources',
    'HMW leverage free time of fellow passengers to share the load?',
  ],
  [
    'Create an analogy from need or context',
    'HMW make the airport like a spa? Like a playground?',
  ],
  [
    'Play POV against the challenge',
    'HMW make the airport a place that kids want to go?',
  ],
  ['Change the status quo', 'HMW make playful, loud kids less annoying?'],
  [
    'Break POV into pieces',
    'HMW entertain kids? HMW slow a mom down? HMW mollify delayed passengers?',
  ],
];

export default function HmwTypes() {
  return (
    <details open className="panel overflow-hidden mb-6 group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 select-none">
        <span className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-[#b9432a]" />
          <span className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
            Ten ways to open an HMW
          </span>
        </span>
        <span className="text-xs text-gray-400 group-open:hidden">Show</span>
        <span className="hidden text-xs text-gray-400 group-open:inline">
          Hide
        </span>
      </summary>

      <div className="border-t border-gray-900/[0.07] bg-blue-50/40 p-5 pt-4">
        <p className="mb-4 text-sm text-gray-500">
          Stuck on one framing? Try a different move. Every example below comes
          from the same point of view — a mother crossing an airport with young
          children — so you can see what each move changes.
        </p>

        <dl className="grid gap-x-8 gap-y-3 md:grid-cols-2">
          {TYPES.map(([move, example]) => (
            <div key={move}>
              <dt className="text-sm font-semibold text-gray-800">{move}</dt>
              <dd className="text-sm text-gray-600">{example}</dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}
