import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';

export default function AdminCustomersPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Customers" subtitle="Manage customer accounts." />
      <div className="p-4 text-center opacity-60">Customer management interface coming soon.</div>
    </OtwPageShell>
  );
}
