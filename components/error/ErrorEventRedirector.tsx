'use client';

import { useEffect } from 'react';
import { buildErrorPageHref, ERROR_PAGE_PATH, normalizeErrorMessage } from '@/lib/error-routing';

function maybeRedirectToErrorPage(error: unknown, source: string) {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === ERROR_PAGE_PATH) return;

  const message = normalizeErrorMessage(error);
  const dedupeKey = `otw:event-error:${window.location.pathname}:${message}`;

  try {
    if (window.sessionStorage.getItem(dedupeKey)) return;
    window.sessionStorage.setItem(dedupeKey, '1');
  } catch {
    // ignore storage failures
  }

  window.location.assign(buildErrorPageHref(message, source));
}

export default function ErrorEventRedirector() {
  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      const payload = event.error ?? event.message;
      if (!payload) return;
      maybeRedirectToErrorPage(payload, 'window-error');
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      maybeRedirectToErrorPage(event.reason, 'unhandled-rejection');
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
