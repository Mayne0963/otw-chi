import React from 'react';
import clsx from 'clsx';

type Variant = 'gold' | 'red' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  as?: 'button' | 'a';
  href?: string;
  variant?: Variant;
  size?: Size;
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-otwGold focus-visible:ring-offset-otwBlack active:translate-y-0.5';

const sizes: Record<Size, string> = {
  sm: 'px-3 py-2 text-xs',
  md: 'px-4 py-3 text-sm',
  lg: 'px-6 py-3.5 text-base'
};

const variants: Record<Variant, string> = {
  gold:
    'bg-otwGold text-otwBlack shadow-otwGlow hover:bg-otwGold/90',
  red:
    'bg-otwRed text-otwOffWhite shadow-otwSoft hover:bg-otwRed/90',
  ghost:
    'bg-transparent text-otwOffWhite/90 border border-white/10 hover:bg-white/5',
  outline:
    'bg-transparent text-otwGold border border-otwGold/50 hover:bg-otwGold/10'
};

export default function OtwButton({
  as = 'button',
  href,
  variant = 'gold',
  size = 'md',
  className,
  children,
  type = 'button',
  disabled,
  ...props
}: Props) {
  const classes = clsx(base, sizes[size], variants[variant], className, disabled && 'opacity-70 cursor-not-allowed');
  if (as === 'a' && href) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} className={classes} disabled={disabled} {...props}>
      {children}
    </button>
  );
}
