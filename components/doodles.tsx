/**
 * Small hand-drawn SVG doodles used as meaningful annotations (pointing at a
 * CTA, circling a stat, marking a highlight) — never as pure filler.
 * All strokes use currentColor so they inherit the accent/ink color in context.
 */

export function DoodleArrow({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 90 60"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M4 8C22 6 55 10 78 34"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M60 26C66 29 74 32 80 33C77 39 73 46 71 53"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function DoodleCircle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 60" fill="none" className={className} aria-hidden="true">
      <path
        d="M60 4C30 2 6 14 5 30C4 47 30 57 62 57C93 57 116 47 114 29C112 13 87 4 60 6"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function DoodleStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <path
        d="M20 3C21 11 22 16 27 19C22 21 21 26 20 34C19 26 18 21 13 19C18 16 19 11 20 3Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.15"
      />
    </svg>
  )
}

export function DoodleUnderline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 14" fill="none" className={className} aria-hidden="true" preserveAspectRatio="none">
      <path
        d="M2 10C24 4 46 12 68 6C90 1 112 11 138 5"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function DoodleCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 30" fill="none" className={className} aria-hidden="true">
      <path
        d="M5 15C8 18 11 21 12 23C15 18 20 10 26 6"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function DoodleSparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <path d="M20 4V16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M20 24V36" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M4 20H16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M24 20H36" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}
