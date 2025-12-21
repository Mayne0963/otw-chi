import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';

export default function AdminNipLedgerPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="NIP Ledger" subtitle="Audit trail of all TIREM transactions." />
      <div className="p-4 text-center opacity-60">Ledger interface coming soon.</div>
    </OtwPageShell>
  );
}
