import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';

export default function TermsPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Terms of Service" subtitle="Your use of OTW is governed by these terms." />
      <OtwCard className="mt-3">
        <p className="text-sm opacity-80">Placeholder terms for production. Replace with legal-approved content.</p>
      </OtwCard>
    </OtwPageShell>
  );
}

