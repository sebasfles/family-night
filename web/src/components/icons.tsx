interface IconProps {
  className?: string;
}

export function MoonIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 64" className={`shrink-0 ${className ?? ''}`}>
      <path d="M40 14a20 20 0 1 0 10 34A16 16 0 0 1 40 14z" fill="currentColor" />
    </svg>
  );
}

export function CrownIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`shrink-0 ${className ?? ''}`}>
      <path
        d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z"
        fill="currentColor"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function MoreIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`shrink-0 ${className ?? ''}`}>
      <circle cx="5" cy="12" r="2" fill="currentColor" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <circle cx="19" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

export function LinkIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 ${className ?? ''}`}
    >
      <path
        d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ShareIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 ${className ?? ''}`}
    >
      <path
        d="M12 15V4m0 0L8 8m4-4l4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 ${className ?? ''}`}
    >
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PencilIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 ${className ?? ''}`}
    >
      <path
        d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SoundIcon({ className, muted }: IconProps & { muted: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 ${className ?? ''}`}
    >
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5z" fill="currentColor" />
      {muted ? (
        <path
          d="M16 9.5l5 5M21 9.5l-5 5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
