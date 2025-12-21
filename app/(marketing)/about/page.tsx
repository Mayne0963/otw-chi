import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';

export default function AboutPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="About OTW" subtitle="Built for the people, with premium motion." />
      <OtwCard className="mt-3">
        <p className="text-sm opacity-80">OTW is a luxury concierge delivery system focused on fair payouts and real community coverage.</p>
      </OtwCard>
    </OtwPageShell>
  );
}

