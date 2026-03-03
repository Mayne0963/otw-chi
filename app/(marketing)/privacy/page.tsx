import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import { Card } from '@/components/ui/card';

const PRIVACY_SECTIONS = [
  {
    title: '1. Information We Collect',
    body: 'We collect account details (name, email, phone), request details (pickup/dropoff and notes), transaction data, and technical usage data needed to operate and secure the service.',
  },
  {
    title: '2. How We Use Information',
    body: 'We use personal information to provide delivery services, process payments, support customer requests, improve product performance, and prevent fraud or abuse.',
  },
  {
    title: '3. Location Data',
    body: 'When enabled, we use location data for routing, dispatch, and order tracking. Location data may be shared with the assigned driver and customer for active requests.',
  },
  {
    title: '4. Payments',
    body: 'Payment processing is handled by third-party providers such as Stripe. OTW does not store full payment card numbers on its servers.',
  },
  {
    title: '5. Sharing of Information',
    body: 'We do not sell personal data. We share data with service providers, delivery participants, and legal authorities only when required to provide services or comply with law.',
  },
  {
    title: '6. Data Retention',
    body: 'We retain information for as long as needed to provide services, maintain records, resolve disputes, enforce terms, and satisfy legal obligations.',
  },
  {
    title: '7. Security',
    body: 'We use administrative, technical, and organizational safeguards designed to protect personal information. No method of transmission or storage is guaranteed to be perfectly secure.',
  },
  {
    title: '8. Your Rights and Choices',
    body: 'Depending on your jurisdiction, you may request access, correction, deletion, or portability of your personal information. You may also opt out of certain communications.',
  },
  {
    title: '9. Children\'s Privacy',
    body: 'OTW is not directed to children under 13, and we do not knowingly collect personal information from children under 13.',
  },
  {
    title: '10. Policy Updates',
    body: 'We may update this policy periodically. Material updates become effective when posted on this page unless otherwise noted.',
  },
  {
    title: '11. Contact',
    body: 'For privacy requests or questions, contact privacy@ontheway.app.',
  },
] as const;

export default function PrivacyPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Privacy Policy" subtitle="Effective Date: March 2, 2026" />

      <Card className="mt-3 p-5 sm:p-6 space-y-6 border-otwGold/30 bg-black/60 text-sm leading-relaxed">
        <p className="text-muted-foreground">
          This Privacy Policy explains how OTW collects, uses, stores, and shares
          personal information when you use our platform.
        </p>

        {PRIVACY_SECTIONS.map((section) => (
          <section key={section.title} className="space-y-2">
            <h3 className="text-base sm:text-lg font-semibold text-white">{section.title}</h3>
            <p className="text-muted-foreground">{section.body}</p>
          </section>
        ))}
      </Card>
    </OtwPageShell>
  );
}
