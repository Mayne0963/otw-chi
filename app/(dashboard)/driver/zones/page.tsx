import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';

export default function DriverZonesPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Driver Zones" subtitle="Your coverage areas." />
      <div className="mt-3 grid sm:grid-cols-3 gap-4">
        {['South Side', 'West Side', 'Downtown'].map((z) => (
          <OtwCard key={z} variant="default" className="p-4">
            <div className="font-semibold">{z}</div>
          </OtwCard>
        ))}
      </div>
    </OtwPageShell>
  );
}

