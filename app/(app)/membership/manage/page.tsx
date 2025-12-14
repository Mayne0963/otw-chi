import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';

export default function ManageMembershipPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Manage Membership" subtitle="Change your tier and billing." />
      <OtwCard className="mt-3">
        <div className="flex gap-2">
          <OtwButton variant="outline">Downgrade</OtwButton>
          <OtwButton variant="gold">Upgrade</OtwButton>
        </div>
      </OtwCard>
    </OtwPageShell>
  );
}

