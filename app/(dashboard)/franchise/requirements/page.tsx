import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import FranchiseRequirements from '@/components/otw/FranchiseRequirements';
import { notFound } from 'next/navigation';
import { isFeatureEnabled } from '@/lib/featureFlags';

export default function FranchiseRequirementsPage() {
  if (!isFeatureEnabled('franchise')) {
    notFound();
  }

  return (
    <OtwPageShell>
      <FranchiseRequirements />
    </OtwPageShell>
  );
}
