import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type Props = {
  title: string;
  subtitle?: string;
  actionHref?: string;
  actionLabel?: string;
};

export default function OtwEmptyState({ title, subtitle, actionHref, actionLabel }: Props) {
  return (
    <Card variant="ghost" className="text-center p-5 sm:p-6">
      <div className="mx-auto w-full max-w-sm space-y-3 py-8">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        {actionHref && actionLabel ? (
          <div className="pt-2">
            <Button asChild variant="gold" size="default">
              <Link href={actionHref}>
                {actionLabel}
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
