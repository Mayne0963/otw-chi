import React from 'react';
import clsx from 'clsx';

type Props = {
  label: string;
  value?: string | number;
  className?: string;
  tone?: 'neutral' | 'success' | 'danger' | 'gold';
};

const tones: Record<NonNullable<Props['tone']>, string> = {
  neutral: 'border-border/70 text-foreground/80',
  success: 'border-otwGold/50 text-otwGold',
  danger: 'border-otwRed/40 text-otwRed',
  gold: 'border-otwGold/50 text-otwGold'
};

export default function OtwStatPill({ label, value, className, tone = 'neutral' }: Props) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs',
        'bg-muted/40',
        tones[tone],
        className
      )}
    >
      <span className="opacity-80">{label}</span>
      {value !== undefined ? <span className="font-semibold">{String(value)}</span> : null}
    </span>
  );
}
