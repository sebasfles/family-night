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

export function CloseIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 ${className ?? ''}`}
    >
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 ${className ?? ''}`}
    >
      <path
        d="M6 9l6 6 6-6"
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

export function MaskIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      fill="none"
      className={`shrink-0 ${className ?? ''}`}
    >
      <path
        d="M4 9c4-2 8-2.5 12-2.5S24 7 28 9c0 8-3.5 15-8.5 15-1.8 0-2.6-2-3.5-2s-1.7 2-3.5 2C7.5 24 4 17 4 9z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 13.5c1.5-1.4 3.7-1.4 5 0M18.5 13.5c1.3-1.4 3.5-1.4 5 0"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DialIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      fill="none"
      className={`shrink-0 ${className ?? ''}`}
    >
      <path d="M4 23a12 12 0 0 1 24 0z" fill="currentColor" fillOpacity="0.2" />
      <path d="M13 11.4a12 12 0 0 1 6 0L16 23z" fill="currentColor" fillOpacity="0.55" />
      <path
        d="M4 23a12 12 0 0 1 24 0M16 23l6-8.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="23" r="2.2" fill="currentColor" />
    </svg>
  );
}

export function CluesIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      fill="none"
      className={`shrink-0 ${className ?? ''}`}
    >
      <rect
        x="4"
        y="7"
        width="15"
        height="11"
        rx="3.5"
        transform="rotate(-8 11.5 12.5)"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="13"
        y="13"
        width="15"
        height="11"
        rx="3.5"
        transform="rotate(6 20.5 18.5)"
        fill="currentColor"
        fillOpacity="0.45"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M17.5 18.5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function EyeIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 ${className ?? ''}`}
    >
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}

export function CowIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      fill="none"
      className={`shrink-0 ${className ?? ''}`}
    >
      <path
        d="M10.5 8.5C9.5 6 7.5 4.5 5 5M21.5 8.5c1-2.5 3-4 5.5-3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <ellipse
        cx="5.5"
        cy="12.5"
        rx="3.5"
        ry="2"
        transform="rotate(20 5.5 12.5)"
        fill="currentColor"
        fillOpacity="0.45"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <ellipse
        cx="26.5"
        cy="12.5"
        rx="3.5"
        ry="2"
        transform="rotate(-20 26.5 12.5)"
        fill="currentColor"
        fillOpacity="0.45"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <rect
        x="8.5"
        y="7.5"
        width="15"
        height="16"
        rx="6.5"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M13 8.2c1 1.8 3.2 2.3 4.6.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <ellipse
        cx="16"
        cy="22"
        rx="6.5"
        ry="4.5"
        fill="currentColor"
        fillOpacity="0.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12.8" cy="14.5" r="1.4" fill="currentColor" />
      <circle cx="19.2" cy="14.5" r="1.4" fill="currentColor" />
      <circle cx="13.6" cy="22" r="1.1" fill="currentColor" />
      <circle cx="18.4" cy="22" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function DeviceIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 ${className ?? ''}`}
    >
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M10.5 18h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
