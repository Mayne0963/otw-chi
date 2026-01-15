import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import { Card } from '@/components/ui/card';

export default function PrivacyPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Privacy Policy" subtitle="Effective Date: December 16, 2024" />
      <Card className="mt-3 space-y-6 text-sm opacity-90 leading-relaxed p-5 sm:p-6">
        <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-200">
          <strong>LEGAL DISCLAIMER:</strong> This is a draft document for development purposes only. 
          It has not been reviewed by legal counsel. Do not use in production without professional legal review.
        </div>

        <section>
          <h3 className="text-lg font-bold text-white mb-2">1. Information We Collect</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Identity Data:</strong> Name, email address, phone number.</li>
            <li><strong>Location Data:</strong> Real-time geolocation data when the app is in use (for drivers and delivery tracking).</li>
            <li><strong>Financial Data:</strong> Payment card details (processed securely via Stripe).</li>
            <li><strong>Usage Data:</strong> Interaction with our services, device information, and log files.</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-bold text-white mb-2">2. How We Use Your Information</h3>
          <p>We use your data to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li>Provide and improve the OTW delivery service.</li>
            <li>Process payments and manage driver payouts.</li>
            <li>Ensure safety and prevent fraud.</li>
            <li>Communicate with you regarding your orders or account.</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-bold text-white mb-2">3. Data Sharing</h3>
          <p>
            We do not sell your personal data. We share data only with:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li><strong>Service Providers:</strong> Stripe (payments), Clerk (authentication), Neon (database).</li>
            <li><strong>Drivers/Customers:</strong> Necessary contact and location info is shared between parties during an active request.</li>
            <li><strong>Legal Authorities:</strong> When required by law or to protect safety.</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-bold text-white mb-2">4. Your Rights (GDPR & CCPA)</h3>
          <p>
            Depending on your location, you may have rights to:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li>Access the personal data we hold about you.</li>
            <li>Request correction or deletion of your data.</li>
            <li>Opt-out of certain data processing.</li>
            <li>Receive your data in a portable format.</li>
          </ul>
          <p className="mt-2">To exercise these rights, contact: privacy@ontheway.app</p>
        </section>

        <section>
          <h3 className="text-lg font-bold text-white mb-2">5. Data Retention</h3>
          <p>
            We retain your data for as long as your account is active or as needed to provide services, comply with legal obligations, and resolve disputes.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-bold text-white mb-2">6. Children&apos;s Privacy</h3>
          <p>
            Our services are not directed to children under 13. We do not knowingly collect personal information from children under 13. 
            If we become aware that a child under 13 has provided us with personal information, we will take steps to delete such information.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-bold text-white mb-2">7. Changes to This Policy</h3>
          <p>
            We may update this privacy policy from time to time. We will notify you of any changes by posting the new privacy policy on this page.
          </p>
        </section>
      </Card>
    </OtwPageShell>
  );
}
