import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';

export default function AdminSettingsPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Admin — Settings" subtitle="System configuration." />
      <OtwCard className="mt-3"><div className="text-sm">Settings placeholder.</div></OtwCard>
    </OtwPageShell>
  );
}

