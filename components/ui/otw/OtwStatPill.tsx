import React from 'react';
import clsx from 'clsx';

type Props = {
  label: string;
  value?: string | number;
  className?: string;
  tone?: 'neutral' | 'success' | 'danger' | 'gold';
};

const tones: Record<NonNullable<Props['tone']>, string> = {
  neutral: 'border-white/15 text-otwOffWhite/90',
  success: 'border-green-500/35 text-green-400',
  danger: 'border-otwRed/40 text-otwRed',
  gold: 'border-otwGold/60 text-otwGold'
};

export default function OtwStatPill({ label, value, className, tone = 'neutral' }: Props) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs',
        'bg-gradient-to-b from-white/5 to-white/0',
        tones[tone],
        className
      )}
    >
      <span className="opacity-80">{label}</span>
      {value !== undefined ? <span className="font-semibold">{String(value)}</span> : null}
    </span>
  );
}

