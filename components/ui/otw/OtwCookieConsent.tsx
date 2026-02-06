'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function OtwCookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consented = window.localStorage.getItem('otw_cookie_consent');
    if (!consented) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShow(true);
    }
  }, []);

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
          <a href="/privacy" className="underline hover:text-secondary transition-colors duration-300">Privacy Policy</a>.
        </div>
        <div className="flex justify-end">
          <Button onClick={accept} variant="gold" size="sm">Accept</Button>
        </div>
      </div>
    </div>
  );
}
