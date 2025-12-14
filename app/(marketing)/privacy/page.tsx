import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';

export default function PrivacyPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Privacy Policy" subtitle="How OTW handles your data." />
      <OtwCard className="mt-3">
        <p className="text-sm opacity-80">Placeholder privacy policy content for production. Replace with legal-approved copy.</p>
      </OtwCard>
    </OtwPageShell>
  );
}

