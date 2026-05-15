import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import { Card } from '@/components/ui/card';

const TERMS_SECTIONS = [
  {
    title: '1. Agreement to Terms',
    body: 'By accessing or using On The Way ("OTW"), you agree to be bound by these Terms of Service and all applicable laws. If you do not agree, do not use the platform.',
  },
  {
    title: '2. Services',
    body: 'OTW provides a pickup-and-delivery coordination platform. Service availability, pricing, and service areas may change at any time.',
  },
  {
    title: '3. Eligibility and Accounts',
    body: 'You must provide accurate account information and keep your credentials secure. You are responsible for all activity under your account.',
  },
  {
    title: '4. Orders and Pickup Rules',
    body: 'OTW is pickup and delivery only. Customers are responsible for placing and prepaying merchant orders unless explicitly agreed otherwise. You must provide complete and accurate pickup, dropoff, and access instructions.',
  },
  {
    title: '5. Payments, Fees, and Refunds',
    body: 'Delivery fees, surcharges, and tips are shown during checkout or request submission. Charges may be processed through Stripe or another payment provider. Refunds and credits are issued at OTW\'s discretion based on the circumstances of the request.',
  },
  {
    title: '6. Cancellations',
    body: 'Requests may be canceled before dispatch. Once a driver has been dispatched or pickup is complete, cancellation fees may apply.',
  },
  {
    title: '7. Prohibited Use',
    body: 'You may not use OTW for illegal, unsafe, or prohibited items or activities, including fraud, harassment, or misuse of payment methods.',
  },
  {
    title: '8. Limitation of Liability',
    body: 'To the maximum extent permitted by law, OTW is not liable for indirect, incidental, special, or consequential damages, including lost profits, data loss, or service interruption.',
  },
  {
    title: '9. Indemnification',
    body: 'You agree to indemnify and hold OTW and its affiliates harmless from claims, damages, and expenses arising from your use of the service or violation of these terms.',
  },
  {
    title: '10. Suspension and Termination',
    body: 'OTW may suspend or terminate access for violations of these terms, safety concerns, abuse, chargebacks, or suspected fraud.',
  },
  {
    title: '11. Changes to These Terms',
    body: 'We may update these Terms from time to time. Continued use of OTW after changes are posted constitutes acceptance of the updated Terms.',
  },
  {
    title: '12. Contact',
    body: 'For legal or policy questions, contact us at privacy@ontheway.app.',
  },
] as const;

export default function TermsPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader
        title="Terms of Service"
        subtitle="Effective Date: March 2, 2026"
      />

      <Card className="mt-3 p-5 sm:p-6 space-y-6 border-otwGold/30 bg-black/80 text-sm leading-relaxed">
        <p className="text-white/75">
          These Terms govern your access to and use of OTW websites, apps, and related
          services.
        </p>

        {TERMS_SECTIONS.map((section) => (
          <section key={section.title} className="space-y-2">
            <h3 className="text-base sm:text-lg font-semibold text-white">{section.title}</h3>
            <p className="text-white/75">{section.body}</p>
          </section>
        ))}
      </Card>
    </OtwPageShell>
  );
}
