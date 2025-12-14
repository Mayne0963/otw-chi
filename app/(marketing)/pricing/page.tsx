import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwButton from '@/components/ui/otw/OtwButton';

export default function PricingPage() {
  return (
    <OtwPageShell>
      <div className="space-y-6">
        <OtwSectionHeader title="Membership Pricing" subtitle="Choose the tier that fits your motion." />
        <div className="grid md:grid-cols-3 gap-4">
          <OtwCard className="p-5">
            <h3 className="text-lg font-semibold">Broski Basic</h3>
            <p className="text-sm opacity-80 mb-3">Pay as you go.</p>
            <div className="text-3xl font-bold mb-2">$9<span className="text-base opacity-70">/mo</span></div>
            <OtwButton variant="outline" className="mt-2 w-full">Choose</OtwButton>
          </OtwCard>
          <OtwCard variant="default" className="p-5 bg-gradient-to-b from-otwBlack to-otwRedDark">
            <h3 className="text-lg font-semibold">Broski+</h3>
            <p className="text-sm opacity-80 mb-3">Priority drivers.</p>
            <div className="text-3xl font-bold mb-2">$19<span className="text-base opacity-70">/mo</span></div>
            <OtwButton variant="gold" className="mt-2 w-full">Choose</OtwButton>
          </OtwCard>
          <OtwCard variant="red" className="p-5 border border-otwGold shadow-otwGlow">
            <h3 className="text-lg font-semibold">Executive Broski</h3>
            <p className="text-sm opacity-90 mb-3">Concierge level.</p>
            <div className="text-3xl font-bold mb-2">$39<span className="text-base opacity-70">/mo</span></div>
            <OtwButton variant="gold" className="mt-2 w-full">Choose</OtwButton>
          </OtwCard>
        </div>
        <OtwCard>
          <OtwSectionHeader title="FAQ" subtitle="Common membership questions" />
          <ul className="mt-3 space-y-2 text-sm opacity-85">
            <li>Can I change tiers anytime? Yes.</li>
            <li>Do unused miles rollover? Executive only.</li>
            <li>Are tips included? Tips are separate.</li>
          </ul>
        </OtwCard>
      </div>
    </OtwPageShell>
  );
}

