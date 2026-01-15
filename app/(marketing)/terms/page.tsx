import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import { Card } from '@/components/ui/card';

export default function TermsPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Terms of Service" subtitle="Effective Date: December 16, 2024" />
      <Card className="mt-3 space-y-6 text-sm opacity-90 leading-relaxed p-5 sm:p-6">
        <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-200">
          <strong>LEGAL DISCLAIMER:</strong> This is a draft document for development purposes only. 
          It has not been reviewed by legal counsel. Do not use in production without professional legal review.
        </div>

        <section>
          <h3 className="text-lg font-bold text-white mb-2">1. Acceptance of Terms</h3>
          <p>
            By accessing or using the OTW Delivery System (&quot;OTW&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). 
            If you do not agree to these Terms, you may not access or use the Service.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-bold text-white mb-2">2. Eligibility</h3>
          <p>
            You must be at least 18 years old to use the Service. By agreeing to these Terms, you represent and warrant that you are at least 18 years of age. 
            Use of the Service by anyone under 13 is strictly prohibited in compliance with COPPA.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-bold text-white mb-2">3. User Accounts</h3>
          <p>
            You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account. 
            You must provide accurate and complete information during registration.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-bold text-white mb-2">4. Driver & Franchise Terms</h3>
          <p>
            <strong>Independent Contractor Status:</strong> Drivers are independent contractors, not employees of OTW. You are responsible for your own taxes, insurance, and vehicle maintenance.
          </p>
          <p className="mt-2">
            <strong>Compliance:</strong> Drivers must possess a valid driver&apos;s license, auto insurance, and comply with all local traffic laws. 
            We reserve the right to deactivate drivers who violate safety standards.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-bold text-white mb-2">5. Prohibited Items & Conduct</h3>
          <p>
            You may not use OTW to transport illegal drugs, hazardous materials, firearms, or any items prohibited by local law. 
            Harassment of drivers or customers will result in immediate account termination.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-bold text-white mb-2">6. Payments & Refunds</h3>
          <p>
            Payments are processed via Stripe. You authorize us to charge your payment method for all fees incurred. 
            Refunds are handled on a case-by-case basis at our sole discretion.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-bold text-white mb-2">7. Limitation of Liability</h3>
          <p>
            To the fullest extent permitted by law, OTW shall not be liable for any indirect, incidental, special, consequential, or punitive damages, 
            or any loss of profits or revenues.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-bold text-white mb-2">8. Dispute Resolution</h3>
          <p>
            Any disputes arising from these Terms shall be resolved through binding arbitration, rather than in court, except where prohibited by law.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-bold text-white mb-2">9. Contact Us</h3>
          <p>
            For legal inquiries, please contact: legal@ontheway.app
          </p>
        </section>
      </Card>
    </OtwPageShell>
  );
}
