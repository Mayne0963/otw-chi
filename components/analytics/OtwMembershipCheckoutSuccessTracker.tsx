'use client';

import { useEffect, useRef } from 'react';
import { trackOtwEvent } from '@/lib/analytics/otwTrack';

export default function OtwMembershipCheckoutSuccessTracker({
  success,
}: {
  success: boolean;
}) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!success) return;
    if (firedRef.current) return;
    firedRef.current = true;

    void trackOtwEvent('MEMBERSHIP_CHECKOUT_COMPLETED', {
      page: '/membership/manage',
      metadata: { source: 'stripe_redirect' },
    });
  }, [success]);

  return null;
}

