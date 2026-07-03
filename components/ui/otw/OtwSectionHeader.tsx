import React from 'react';

type Props = {
  title: string;
  subtitle?: string;
  className?: string;
};

export default function OtwSectionHeader({ title, subtitle, className }: Props) {
  return (
    <div className={`space-y-1 ${className ?? ''}`}>
      <h2 className="text-xl sm:text-2xl font-semibold tracking-tight font-display">{title}</h2>
      {subtitle ? (
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}
