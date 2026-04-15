import React from 'react';
import clsx from 'clsx';

type Variant = 'default' | 'red' | 'gold' | 'ghost';

type Props = {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
};

const base = 'rounded-2xl transition-all duration-300 will-change-auto';

const variants: Record<Variant, string> = {
  default:
    'bg-card/90 border border-border/70 shadow-otwSoft hover:-translate-y-0.5 hover:shadow-otwElevated',
  red:
    'bg-primary text-primary-foreground border border-primary/40 shadow-otwGlow hover:shadow-otwElevated [&_h2]:text-primary-foreground [&_h3]:text-primary-foreground [&_p]:text-primary-foreground/85 [&_section]:border-primary-foreground/25 [&_section]:bg-primary-foreground/5',
  gold:
    'bg-secondary text-secondary-foreground border border-secondary/60 shadow-otwGlow hover:shadow-otwElevated [&_h2]:text-secondary-foreground [&_h3]:text-secondary-foreground [&_p]:text-secondary-foreground/85',
  ghost:
    'bg-transparent border border-border/60 hover:border-secondary/60'
};

export default function OtwCard({ variant = 'default', className, children }: Props) {
  return (
    <section className={clsx(base, variants[variant], 'p-5 sm:p-6', className)}>
      {children}
    </section>
  );
}
