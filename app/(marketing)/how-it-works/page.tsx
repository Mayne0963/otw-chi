import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How It Works',
  description:
    'How OTW delivery works in Fort Wayne — submit a request, confirm the details, and we handle the last-mile pickup and dropoff. Per-delivery pricing, memberships optional.',
  alternates: { canonical: '/how-it-works' },
};

export default function HowItWorksPage() {
  const services = [
    { title: 'Food Pickup', emoji: '🍔', copy: 'From your favorite spot to your door.' },
    { title: 'Store / Grocery', emoji: '🛒', copy: 'Errands handled with care.' },
    { title: 'Fragile Delivery', emoji: '📦', copy: 'Premium handling for delicate goods.' },
    { title: 'Custom Concierge', emoji: '🏁', copy: 'Tell us what you need, we move.' },
  ];

  return (
    <OtwPageShell>
      <div className="space-y-8">
        <OtwCard
          variant="red"
          className="border-[#f9f5ec]/20 bg-[#b00017] text-[#f9f5ec] [&_h2]:text-[#f9f5ec] [&_p]:text-[#f9f5ec]/85 [&_section]:border-[#f9f5ec]/25 [&_section]:bg-[#f9f5ec]/10"
        >
          <OtwSectionHeader title="How OTW Works" subtitle="Per-delivery pickup and dispatch for Fort Wayne — memberships optional." />
          <div className="mt-3 grid sm:grid-cols-2 gap-4">
            <OtwCard variant="ghost" className="text-[#f9f5ec]">
              <p className="text-sm">1. Order and pay the merchant direct, or tell us the handoff.</p>
            </OtwCard>
            <OtwCard variant="ghost" className="text-[#f9f5ec]">
              <p className="text-sm">2. Submit the pickup, dropoff, and delivery details.</p>
            </OtwCard>
            <OtwCard variant="ghost" className="text-[#f9f5ec]">
              <p className="text-sm">3. Confirm the delivery fee before dispatch.</p>
            </OtwCard>
            <OtwCard variant="ghost" className="text-[#f9f5ec]">
              <p className="text-sm">4. Track it to the door — handled clean.</p>
            </OtwCard>
          </div>
        </OtwCard>

        <section>
          <OtwSectionHeader title="Clear Requests" subtitle="One flow for every delivery." />
          <OtwCard variant="default" className="p-4">
            <div className="text-sm opacity-80">Simple handoff</div>
            <div className="text-2xl font-bold mt-1">Tell us what you need and confirm before dispatch.</div>
          </OtwCard>
        </section>

        <section>
          <OtwSectionHeader title="Our Services" subtitle="Local runs across Fort Wayne." />
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {services.map((it) => (
              <OtwCard key={it.title} variant="default" className="p-4">
                <div className="text-xl font-semibold flex items-center gap-2">
                  <span>{it.emoji}</span>
                  <span>{it.title}</span>
                </div>
                <p className="text-sm opacity-80 mt-2">{it.copy}</p>
              </OtwCard>
            ))}
          </div>
        </section>
      </div>
    </OtwPageShell>
  );
}
