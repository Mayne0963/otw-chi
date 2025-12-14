import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';

export default function AdminCitiesZonesPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Admin — Cities & Zones" subtitle="CRUD coverage areas." />
      <OtwCard className="mt-3">
        <div className="flex gap-2">
          <OtwButton variant="gold">Add City</OtwButton>
          <OtwButton variant="outline">Add Zone</OtwButton>
        </div>
      </OtwCard>
    </OtwPageShell>
  );
}

