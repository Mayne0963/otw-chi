import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';

export default function SettingsPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Settings" subtitle="Profile and addresses." />
      <OtwCard className="mt-3 space-y-3">
        <input className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Name" />
        <input className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Phone" />
        <OtwButton variant="gold">Save</OtwButton>
      </OtwCard>
    </OtwPageShell>
  );
}

