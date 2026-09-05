import { useId } from 'react';

/**
 * Two discs with the overlap cut away, so the lens between them is a hard
 * edge rather than a shade — it survives at 20px in a browser tab.
 *
 * It reads as two viewpoints laid over each other, which is what the app is
 * for: your interview and your team's, judged against the same rubric.
 */
export function LogoMark({ className = 'h-5 w-5' }: { className?: string }) {
  // Two marks render on the same page (header, and a page's own heading), so
  // the mask ids have to be per-instance or the second one reuses the first.
  const id = useId();
  const maskId = `dc-mask-${id}`;
  const clipId = `dc-clip-${id}`;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="9.1" cy="12" r="6.1" />
        </clipPath>
        <mask id={maskId}>
          <circle cx="9.1" cy="12" r="6.1" fill="#fff" />
          <circle cx="14.9" cy="12" r="6.1" fill="#fff" />
          <g clipPath={`url(#${clipId})`}>
            <circle cx="14.9" cy="12" r="6.1" fill="#000" />
          </g>
        </mask>
      </defs>
      <rect
        width="24"
        height="24"
        fill="currentColor"
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}

/** The mark on its gradient tile, beside the wordmark. */
export default function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const tile = size === 'lg' ? 'w-10 h-10 rounded-xl' : 'w-8 h-8 rounded-lg';
  const mark = size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  const text = size === 'lg' ? 'text-xl' : 'text-base';

  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={`${tile} bg-gradient-to-br from-violet-500 via-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-violet-600/25`}
      >
        <LogoMark className={mark} />
      </span>
      <span className={`${text} font-bold tracking-tight text-gray-900`}>
        Dual<span className="text-violet-600">Crit</span>
      </span>
    </span>
  );
}
