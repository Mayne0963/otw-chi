import type { Metadata } from 'next';
import '../styles/globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import OtwNavbar from '@/components/otw/OtwNavbar';

export const metadata: Metadata = {
  title: 'OTW Delivery System',
  description: 'Enterprise-ready skeleton for the OTW Delivery System'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const hasClerk =
    !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !!process.env.CLERK_PUBLISHABLE_KEY;
  return (
    <html lang="en">
      <body className="min-h-screen bg-otwBlack text-otwOffWhite antialiased">
        {hasClerk ? (
          <ClerkProvider>
            <OtwNavbar />
            <main className="py-6">
              {children}
            </main>
            <footer className="max-w-5xl mx-auto px-4 py-6 text-sm opacity-80">
              © OTW – On The Way. Built for the People.
            </footer>
          </ClerkProvider>
        ) : (
          <>
            <OtwNavbar />
            <main className="py-6">
              {children}
            </main>
            <footer className="max-w-5xl mx-auto px-4 py-6 text-sm opacity-80">
              © OTW – On The Way. Built for the People.
            </footer>
          </>
        )}
      </body>
    </html>
  );
}
