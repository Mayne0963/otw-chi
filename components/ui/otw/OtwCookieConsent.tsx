'use client';

import { useState } from 'react';
import OtwButton from './OtwButton';

export default function OtwCookieConsent() {
  const [show, setShow] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return !window.localStorage.getItem('otw_cookie_consent');
  });

  const accept = () => {
    localStorage.setItem('otw_cookie_consent', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom-5 fade-in duration-500">
      <div className="bg-card/95 border border-border/70 rounded-xl p-4 shadow-otwElevated flex flex-col gap-3 backdrop-blur-md">
        <div className="text-sm text-foreground/85">
          <strong>We use cookies</strong> to improve your experience and for analytics.
          By using OTW, you agree to our{" "}
          <a href="/privacy" className="underline hover:text-primary transition-colors duration-300">Privacy Policy</a>.
        </div>
        <div className="flex justify-end">
          <OtwButton onClick={accept} variant="gold" size="sm">Accept</OtwButton>
        </div>
      </div>
    </div>
  );
}
