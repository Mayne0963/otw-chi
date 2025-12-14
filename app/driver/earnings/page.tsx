import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';

export default function DriverEarningsPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Driver Earnings" subtitle="Ledger summary and payouts." />
      <OtwCard className="mt-3">
        <p className="text-sm opacity-80">No earnings yet.</p>
      </OtwCard>
    </OtwPageShell>
  );
}

