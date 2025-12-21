import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';

export default function CityCoveragePage({ params }: { params: { city: string } }) {
  const city = params.city;
  const zones = ['South Side', 'West Side', 'Downtown'];
  return (
    <OtwPageShell>
      <OtwSectionHeader title={`OTW – ${city.toUpperCase()}`} subtitle="Active coverage zones" />
      <div className="mt-3 grid sm:grid-cols-3 gap-4">
        {zones.map((z) => (
          <OtwCard key={z} variant="default" className="p-4">
            <div className="font-semibold">{z}</div>
            <p className="text-sm opacity-75">Premium runs available</p>
          </OtwCard>
        ))}
      </div>
    </OtwPageShell>
  );
}

