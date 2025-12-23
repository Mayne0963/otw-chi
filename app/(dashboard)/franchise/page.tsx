import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';

export default function FranchisePage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="OTW Franchise" subtitle="Zone ownership and local operations." />
      <OtwCard className="mt-3">
        <p className="text-sm opacity-80">Own a city zone and operate OTW runs with revenue share.</p>
        <div className="mt-3">
          <OtwButton as="a" href="/franchise/apply" variant="gold">Apply</OtwButton>
        </div>
      </OtwCard>
    </OtwPageShell>
  );
}

