import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';

export default function AdminCustomersPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Admin — Customers" subtitle="Directory and status." />
      <OtwCard className="mt-3"><div className="text-sm">No data yet.</div></OtwCard>
    </OtwPageShell>
  );
}

