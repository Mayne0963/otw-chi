import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';

export default function AdminOverviewPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="OTW HQ — Admin" subtitle="KPIs and system overview." />
      <div className="mt-3 grid md:grid-cols-3 gap-4">
        <OtwCard><div className="text-sm font-medium">Requests Today</div></OtwCard>
        <OtwCard><div className="text-sm font-medium">Active Drivers</div></OtwCard>
        <OtwCard><div className="text-sm font-medium">NIP Issued</div></OtwCard>
      </div>
    </OtwPageShell>
  );
}

