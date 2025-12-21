import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';

export default function DriverApplyPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Apply as OTW Driver" subtitle="Join the team and earn fair payouts." />
      <OtwCard className="mt-3 space-y-3">
        <input className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Full Name" />
        <input className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Email" />
        <input className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Home Zone" />
        <OtwButton variant="gold" className="w-full">Submit Application</OtwButton>
      </OtwCard>
    </OtwPageShell>
  );
}

