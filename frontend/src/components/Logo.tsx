export const BRAND_BLUE = '#2563eb';
export const BRAND_CORAL = '#f0704f';

/**
 * Two bracket halves facing each other, with a spark in the gap between them.
 *
 * The halves are the two critiques — the question and the interview — and the
 * space they leave is where the judgement happens. Drawn rather than imported
 * so it stays sharp at any size and can inherit the page's colours.
 */
export function LogoMark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* Left half: rounded on the outside, notched into a "<" on the inside. */}
      <path
        d="M44 11H31C19.954 11 11 19.954 11 31v34c0 11.046 8.954 20 20 20h13L28.5 48Z"
        fill={BRAND_BLUE}
      />
      {/* Right half: the same shape mirrored about the centre line. */}
      <path
        d="M52 11h13c11.046 0 20 8.954 20 20v34c0 11.046-8.954 20-20 20H52l15.5-37Z"
        fill={BRAND_CORAL}
      />
      {/* The spark, sitting in the negative space the two halves leave. Four
          points with concave sides, so it reads as a spark and not a plus. */}
      <path
        d="M48 30 Q50.5 45 62 48 Q50.5 51 48 66 Q45.5 51 34 48 Q45.5 45 48 30 Z"
        fill={BRAND_CORAL}
      />
      <rect
        x="46.7"
        y="60"
        width="2.6"
        height="18"
        rx="1.3"
        fill={BRAND_CORAL}
      />
    </svg>
  );
}

/** The mark beside the wordmark. */
export default function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const mark = size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';
  const text = size === 'lg' ? 'text-2xl' : 'text-lg';

  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark className={mark} />
      <span className={`${text} font-semibold tracking-tight text-gray-900`}>
        Dual<span style={{ color: BRAND_CORAL }}>Crit</span>
      </span>
    </span>
  );
}
