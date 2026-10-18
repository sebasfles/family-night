import type { ButtonHTMLAttributes, Ref } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const variants: Record<Variant, string> = {
  primary: 'bg-moon text-night hover:bg-moon/90',
  secondary: 'bg-night-soft text-cream ring-1 ring-cream/15 hover:bg-night-soft/70',
  danger: 'bg-red-500 text-white hover:bg-red-500/90',
  ghost: 'text-cream/80 hover:bg-cream/10',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  busy?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = 'primary',
  busy = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled === true || busy}
      aria-busy={busy || undefined}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-lg font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-moon focus-visible:ring-offset-2 focus-visible:ring-offset-night focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {busy && (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      )}
      {children}
    </button>
  );
}
