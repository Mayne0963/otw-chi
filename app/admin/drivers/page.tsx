import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';

export default function AdminDriversPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Admin — Drivers" subtitle="Approve and assign zones." />
      <OtwCard className="mt-3"><div className="text-sm">No data yet.</div></OtwCard>
    </OtwPageShell>
  );
}

