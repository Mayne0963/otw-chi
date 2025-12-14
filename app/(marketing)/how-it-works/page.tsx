import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';

export default function HowItWorksPage() {
  return (
    <OtwPageShell>
      <div className="space-y-6">
        <OtwCard variant="red">
          <OtwSectionHeader title="How OTW Works" subtitle="Luxury concierge delivery with clear steps." />
          <div className="mt-3 grid sm:grid-cols-2 gap-4">
            <OtwCard variant="ghost"><p className="text-sm">1. Request what you need.</p></OtwCard>
            <OtwCard variant="ghost"><p className="text-sm">2. We match a driver in your zone.</p></OtwCard>
            <OtwCard variant="ghost"><p className="text-sm">3. Picked up with care, delivered fast.</p></OtwCard>
            <OtwCard variant="ghost"><p className="text-sm">4. Earn NIP rewards along the way.</p></OtwCard>
          </div>
        </OtwCard>
      </div>
    </OtwPageShell>
  );
}

