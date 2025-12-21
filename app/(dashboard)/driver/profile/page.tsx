import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';

export default function DriverProfilePage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Driver Profile" subtitle="Update your info and zones." />
      <OtwCard className="mt-3 space-y-3">
        <input className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Display Name" />
        <OtwButton variant="gold">Save</OtwButton>
      </OtwCard>
    </OtwPageShell>
  );
}

