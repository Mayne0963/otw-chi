import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import FranchiseRequirements from '@/components/otw/FranchiseRequirements';
import { notFound } from 'next/navigation';
import { getServerCapabilities } from '@/lib/capabilities';

export default function FranchiseRequirementsPage() {
  const capabilities = getServerCapabilities();
  if (!capabilities.canSeeFranchise) {
    notFound();
  }

  return (
    <OtwPageShell>
      <FranchiseRequirements />
    </OtwPageShell>
  );
}
