import React from 'react';
import OtwCard from './OtwCard';
import OtwButton from './OtwButton';

type Props = {
  title: string;
  subtitle?: string;
  actionHref?: string;
  actionLabel?: string;
};

export default function OtwEmptyState({ title, subtitle, actionHref, actionLabel }: Props) {
  return (
    <OtwCard variant="ghost" className="text-center">
      <div className="mx-auto w-full max-w-sm space-y-3 py-8">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        {actionHref && actionLabel ? (
          <div className="pt-2">
            <OtwButton as="a" href={actionHref} variant="gold" size="md">
              {actionLabel}
            </OtwButton>
          </div>
        ) : null}
      </div>
    </OtwCard>
  );
}
