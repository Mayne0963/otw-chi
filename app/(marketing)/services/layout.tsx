import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Our Services',
  description:
    'Food pickup, store and grocery runs, fragile delivery, and custom concierge — OTW handles last-mile delivery and dispatch across Fort Wayne.',
  alternates: { canonical: '/services' },
};

export default function ServicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
