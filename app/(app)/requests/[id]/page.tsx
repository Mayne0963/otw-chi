import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwStatPill from '@/components/ui/otw/OtwStatPill';

export default function RequestDetailPage({ params }: { params: { id: string } }) {
  const id = params.id;
  return (
    <OtwPageShell>
      <OtwSectionHeader title={`Request ${id}`} subtitle="Status timeline and events." />
      <div className="mt-3 grid md:grid-cols-3 gap-4">
        <OtwCard>
          <div className="text-sm font-medium">Status</div>
          <div className="mt-2"><OtwStatPill label="State" value="DRAFT" /></div>
        </OtwCard>
        <OtwCard className="md:col-span-2">
          <div className="text-sm font-medium">Events</div>
          <ul className="mt-2 text-sm opacity-80 list-disc pl-5">
            <li>Created draft</li>
          </ul>
        </OtwCard>
      </div>
    </OtwPageShell>
  );
}

