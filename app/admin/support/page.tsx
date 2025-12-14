import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';

export default function AdminSupportPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Admin — Support" subtitle="Ticket queue and actions." />
      <OtwCard className="mt-3"><div className="text-sm">No tickets yet.</div></OtwCard>
    </OtwPageShell>
  );
}

