'use client';

import OtwButton from '@/components/ui/otw/OtwButton';
import { trackOtwEvent, type OtwServiceType } from '@/lib/analytics/otwTrack';

export default function TrackedOtwButtonLink({
  href,
  ctaId,
  ctaLocation,
  serviceType,
  children,
  ...props
}: {
  href: string;
  ctaId: string;
  ctaLocation: string;
  serviceType?: OtwServiceType;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof OtwButton>, 'href' | 'as' | 'children'>) {
  return (
    <OtwButton
      {...props}
      as="a"
      href={href}
      onClick={(event) => {
        props.onClick?.(event as unknown as React.MouseEvent<HTMLButtonElement>);
        void trackOtwEvent('CTA_CLICK', {
          page: window.location.pathname,
          serviceType,
          metadata: { ctaId, ctaLocation },
        });
      }}
    >
      {children}
    </OtwButton>
  );
}

