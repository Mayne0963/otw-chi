import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';

export default function HomePage() {
  return (
    <OtwPageShell
      header={
        <OtwSectionHeader
          title="On The Way"
          subtitle="Luxury delivery concierge for the block, the business, and the busy."
        />
      }
    >
      <div className="space-y-6">
        <OtwCard variant="red" className="mt-2">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <p className="text-otwOffWhite/75 text-sm">Your need moves when you do.</p>
              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <OtwButton as="a" href="/customer" variant="gold">Request a Delivery</OtwButton>
                <OtwButton as="a" href="/membership" variant="outline">Become a Member</OtwButton>
                <OtwButton as="a" href="/driver" variant="ghost">Track My Driver</OtwButton>
              </div>
            </div>
            <div className="flex-1 flex md:justify-end">
              <div className="w-28 h-28 md:w-40 md:h-40 rounded-full bg-otwBlack/20 border border-otwGold/40 shadow-otwGlow" aria-hidden="true" />
            </div>
          </div>
        </OtwCard>

        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: 'Food Pickup', emoji: '🍔' },
              { title: 'Store / Grocery', emoji: '🛒' },
              { title: 'Fragile Delivery', emoji: '📦' },
              { title: 'Custom Concierge', emoji: '🏁' },
            ].map(({ title, emoji }) => (
              <OtwCard key={title} variant="default" className="p-4">
                <div className="text-xl font-semibold flex items-center gap-2">
                  <span>{emoji}</span>
                  <span>{title}</span>
                </div>
              </OtwCard>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <OtwSectionHeader title="Why OTW?" />
          <ul className="list-disc pl-5 space-y-1 text-otwOffWhite/85">
            <li>Membership-based savings</li>
            <li>Fair driver payouts</li>
            <li>NIP Coin rewards for the youth</li>
          </ul>
        </section>
      </div>
    </OtwPageShell>
  );
}
