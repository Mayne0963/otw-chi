import React from 'react';
import clsx from 'clsx';

type Variant = 'default' | 'red' | 'gold' | 'ghost';

type Props = {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
};

const base = 'rounded-3xl transition transform will-change-auto';

const variants: Record<Variant, string> = {
  default:
    'bg-otwBlack/50 backdrop-blur-sm border border-white/10 shadow-otwSoft hover:shadow-otwSoft hover:scale-[1.01]',
  red:
    'bg-gradient-to-b from-otwRed to-otwRedDark text-otwOffWhite border border-otwRedDark/40 shadow-otwGlow hover:shadow-otwGlow hover:brightness-105',
  gold:
    'bg-gradient-to-b from-otwGold to-[#c5a65a] text-otwBlack border border-otwGold/60 shadow-otwGlow hover:shadow-otwGlow',
  ghost:
    'bg-transparent border border-white/10 hover:border-white/20'
};

export default function OtwCard({ variant = 'default', className, children }: Props) {
  return (
    <section className={clsx(base, variants[variant], 'p-5 sm:p-6', className)}>
      {children}
    </section>
  );
}

