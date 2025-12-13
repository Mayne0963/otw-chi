import React from 'react';
import clsx from 'clsx';

type Variant = 'gold' | 'red' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  as?: 'button' | 'a';
  href?: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
};

const base =
  'inline-flex items-center justify-center rounded-2xl font-semibold transition transform focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-otwGold focus-visible:ring-offset-otwBlack';

const sizes: Record<Size, string> = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-3 text-sm',
  lg: 'px-5 py-3.5 text-base'
};

const variants: Record<Variant, string> = {
  gold:
    'bg-gradient-to-b from-otwGold to-[#c5a65a] text-otwBlack shadow-otwGlow hover:brightness-105',
  red:
    'bg-gradient-to-b from-otwRed to-otwRedDark text-otwOffWhite shadow-otwSoft hover:brightness-110',
  ghost:
    'bg-transparent text-otwOffWhite/90 hover:text-otwOffWhite border border-white/10',
  outline:
    'bg-transparent text-otwGold border border-otwGold hover:bg-otwGold/10'
};

export default function OtwButton({
  as = 'button',
  href,
  variant = 'gold',
  size = 'md',
  className,
  children,
  onClick,
  disabled
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
    <button type="button" className={classes} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

