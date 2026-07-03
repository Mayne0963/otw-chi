'use client';

import { useEffect, useRef } from 'react';
import { getOtwSessionId } from '@/lib/analytics/otwTrack';

export default function OtwSessionIdField({
  name = 'otwSessionId',
}: {
  name?: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.value = getOtwSessionId();
  }, []);

  return <input ref={ref} type="hidden" name={name} defaultValue="" />;
}
