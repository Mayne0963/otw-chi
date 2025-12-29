import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import '../styles/globals.css';
import OtwCookieConsent from '@/components/ui/otw/OtwCookieConsent';

export const metadata: Metadata = {
  title: 'OTW Delivery System',
  description: 'Enterprise-ready skeleton for the OTW Delivery System'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const signInUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? '/sign-in';
  const signUpUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL ?? '/sign-up';
  const signInFallbackRedirectUrl = process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL ?? '/dashboard';
  const signUpFallbackRedirectUrl = process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL ?? '/onboarding';

  return (
    <ClerkProvider
      signInUrl={signInUrl}
      signUpUrl={signUpUrl}
      signInFallbackRedirectUrl={signInFallbackRedirectUrl}
      signUpFallbackRedirectUrl={signUpFallbackRedirectUrl}
    >
      <html lang="en">
        <body className="min-h-screen bg-otwBlack text-otwOffWhite antialiased relative selection:bg-otwGold/30 selection:text-otwGold">
          {/* Global background effect */}
          <div className="fixed inset-0 z-[-1] pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-otwGold/5 rounded-full blur-3xl opacity-20" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-otwRed/5 rounded-full blur-3xl opacity-20" />
          </div>
          
          {children}
          <OtwCookieConsent />
        </body>
      </html>
    </ClerkProvider>
  );
}
