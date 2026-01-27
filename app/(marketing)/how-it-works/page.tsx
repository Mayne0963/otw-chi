import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';

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
        <OtwCard variant="red">
          <OtwSectionHeader title="How OTW Works" subtitle="Subscription-first concierge with Service Miles." />
          <div className="mt-3 grid sm:grid-cols-2 gap-4">
            <OtwCard variant="ghost"><p className="text-sm">1. Pick a monthly plan.</p></OtwCard>
            <OtwCard variant="ghost"><p className="text-sm">2. Use Service Miles for any request.</p></OtwCard>
            <OtwCard variant="ghost"><p className="text-sm">3. Approve the cost before service starts.</p></OtwCard>
            <OtwCard variant="ghost"><p className="text-sm">4. Relax — it’s handled.</p></OtwCard>
          </div>
        </OtwCard>

        <section>
          <OtwSectionHeader title="Service Miles" subtitle="One definition, everywhere." />
          <OtwCard variant="default" className="p-4">
            <div className="text-sm opacity-80">1 Service Mile</div>
            <div className="text-2xl font-bold mt-1">5 minutes of human time + effort absorbed on your behalf</div>
          </OtwCard>
        </section>

        <section>
          <OtwSectionHeader title="Avoid This" subtitle="The #1 mistake and how OTW dodges it." />
          <OtwCard variant="default" className="p-4 space-y-3">
            <div className="text-sm font-semibold">Mistake</div>
            <div className="text-sm opacity-80">Letting customers treat OTW like Uber with better vibes.</div>
            <div className="text-sm font-semibold mt-4">OTW Fix</div>
            <div className="text-sm opacity-80">
              Subscription-first, Service Miles rules up front, and business accounts prioritized.
              OTW is infrastructure, not a convenience toy.
            </div>
          </OtwCard>
        </section>

        <section>
          <OtwSectionHeader title="Our Services" subtitle="Premium runs for the city." />
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
