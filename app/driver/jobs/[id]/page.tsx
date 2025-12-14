import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';

export default function DriverJobDetailPage({ params }: { params: { id: string } }) {
  return (
    <OtwPageShell>
      <OtwSectionHeader title={`Job ${params.id}`} subtitle="Update status and view details." />
      <OtwCard className="mt-3">
        <div className="flex gap-2">
          <OtwButton variant="outline">Picked Up</OtwButton>
          <OtwButton variant="gold">Delivered</OtwButton>
        </div>
      </OtwCard>
    </OtwPageShell>
  );
}

