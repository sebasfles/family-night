import type { ButtonHTMLAttributes, Ref } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const variants: Record<Variant, string> = {
  primary:
    'bg-linear-to-b from-moon-bright to-moon text-night shadow-glow inset-ring inset-ring-white/25 hover:brightness-105',
  secondary: 'bg-night-raised text-cream ring-1 ring-cream/12 hover:bg-night-raised/80',
  danger: 'bg-ember text-night hover:brightness-105',
  ghost: 'text-cream/80 hover:bg-cream/8',
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
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-lg font-bold transition-[transform,filter,background-color] duration-150 ease-soft focus-visible:ring-2 focus-visible:ring-moon focus-visible:ring-offset-2 focus-visible:ring-offset-night focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:active:scale-100 motion-safe:active:scale-[0.97] ${variants[variant]} ${className}`}
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
