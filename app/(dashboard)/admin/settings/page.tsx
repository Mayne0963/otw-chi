import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';

export default function AdminSettingsPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Admin Settings" subtitle="System configuration." />
      <div className="p-4 text-center opacity-60">System settings interface coming soon.</div>
    </OtwPageShell>
  );
}
