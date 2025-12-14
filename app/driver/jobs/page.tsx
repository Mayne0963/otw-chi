import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';

export default function DriverJobsPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Driver Jobs" subtitle="Available, active, completed." />
      <div className="mt-3 grid md:grid-cols-2 gap-4">
        <OtwCard><div className="text-sm font-medium">Available</div></OtwCard>
        <OtwCard><div className="text-sm font-medium">Active</div></OtwCard>
        <OtwCard className="md:col-span-2"><div className="text-sm font-medium">Completed</div></OtwCard>
      </div>
    </OtwPageShell>
  );
}

