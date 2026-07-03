import React from 'react';
import clsx from 'clsx';

type Tone = 'neutral' | 'success' | 'danger' | 'gold' | 'info';

type Props = {
  label?: string;
  value?: string | number;
  className?: string;
  tone?: Tone;
  children?: React.ReactNode;
};

const tones: Record<Tone, string> = {
  neutral: 'border-border/70 text-foreground/80 bg-muted/40',
  success: 'border-transparent bg-green-500/20 text-green-400',
  danger: 'border-otwRed/40 text-otwRed bg-red-500/10',
  gold: 'border-otwGold/50 text-otwGold bg-otwGold/10',
  info: 'border-blue-500/30 text-blue-400 bg-blue-500/10'
};

export default function OtwStatPill({ label, value, className, tone = 'neutral', children }: Props) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        tones[tone],
        className
      )}
    >
      {children ? (
        children
      ) : (
        <>
          {label && <span className="opacity-90">{label}</span>}
          {value !== undefined ? <span className="font-bold">{String(value)}</span> : null}
        </>
      )}
    </span>
  );
}
