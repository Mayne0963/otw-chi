import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import '../styles/globals.css';
import OtwNavbar from '@/components/otw/OtwNavbar';
import OtwCookieConsent from '@/components/ui/otw/OtwCookieConsent';

export const metadata: Metadata = {
  title: 'OTW Delivery System',
  description: 'Enterprise-ready skeleton for the OTW Delivery System'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const signInUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? '/sign-in';
  const signUpUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL ?? '/sign-up';
  const afterSignInUrl = process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL ?? '/dashboard';
  const afterSignUpUrl = process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL ?? '/onboarding';

  return (
    <ClerkProvider signInUrl={signInUrl} signUpUrl={signUpUrl} afterSignInUrl={afterSignInUrl} afterSignUpUrl={afterSignUpUrl}>
      <html lang="en">
        <body className="min-h-screen bg-otwBlack text-otwOffWhite antialiased">
          <OtwNavbar />
          <main className="max-w-5xl mx-auto px-4 py-6">
            {children}
          </main>
          <footer className="max-w-5xl mx-auto px-4 py-6 text-sm opacity-80">
            © OTW – On The Way. Built for the People.
          </footer>
          <OtwCookieConsent />
        </body>
      </html>
    </ClerkProvider>
  );
}
