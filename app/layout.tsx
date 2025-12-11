import type { Metadata } from 'next';
import '../styles/globals.css';
import OtwNavbar from '@/components/otw/OtwNavbar';

export const metadata: Metadata = {
  title: 'OTW Delivery System',
  description: 'Enterprise-ready skeleton for the OTW Delivery System'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-otwBlack text-otwOffWhite antialiased">
        <OtwNavbar />
        <main className="max-w-5xl mx-auto px-4 py-6">
          {children}
        </main>
        <footer className="max-w-5xl mx-auto px-4 py-6 text-sm opacity-80">
          © OTW – On The Way. Built for the People.
        </footer>
      </body>
    </html>
  );
}
