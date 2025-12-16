'use client';

import { useState, useEffect } from 'react';
import OtwButton from './OtwButton';

export default function OtwCookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('otw_cookie_consent');
    if (!consent) {
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
      <div className="bg-otwBlack border border-white/10 rounded-xl p-4 shadow-2xl flex flex-col gap-3 backdrop-blur-md bg-opacity-95">
        <div className="text-sm opacity-90 text-otwOffWhite">
          <strong>We use cookies</strong> to improve your experience and for analytics. 
          By using OTW, you agree to our <a href="/privacy" className="underline hover:text-otwGold transition-colors">Privacy Policy</a>.
        </div>
        <div className="flex justify-end">
          <OtwButton onClick={accept} variant="gold" size="sm">Accept</OtwButton>
        </div>
      </div>
    </div>
  );
}
