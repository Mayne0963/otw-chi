'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type QueryPopupAlertProps = {
  message?: string | null;
  clearParam: string;
};

export default function QueryPopupAlert({ message, clearParam }: QueryPopupAlertProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shownMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (!message) return;
    if (shownMessageRef.current === message) return;
    shownMessageRef.current = message;

    window.alert(message);

    const next = new URLSearchParams(searchParams.toString());
    next.delete(clearParam);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [clearParam, message, pathname, router, searchParams]);

  return null;
}
