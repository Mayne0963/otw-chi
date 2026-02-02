import type { Metadata, Viewport } from 'next';
import { AppNeonAuthProvider } from '@/components/neon-auth-provider';
import { Fraunces, Manrope } from 'next/font/google';
import '../styles/globals.css';
import OtwCookieConsent from '@/components/ui/otw/OtwCookieConsent';
import { ThemeProvider } from '@/components/theme-provider';

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0c0c0c',
};

export const metadata: Metadata = {
  title: 'OTW Delivery System',
  description: 'Enterprise-ready skeleton for the OTW Delivery System'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icons/otw-192.svg" />
        <link rel="apple-touch-icon" href="/icons/otw-192.svg" />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased relative font-sans">
        <AppNeonAuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <OtwCookieConsent />
          </ThemeProvider>
        </AppNeonAuthProvider>
      </body>
    </html>
  );
}
