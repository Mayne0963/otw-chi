import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';

export default function DriverDashboardPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Driver Dashboard" subtitle="Assigned jobs and status." />
      <OtwCard className="mt-3">
        <OtwEmptyState title="No assigned jobs" subtitle="Go online to receive jobs." actionHref="/driver/jobs" actionLabel="View Jobs" />
        <div className="mt-3"><OtwButton variant="outline">Go Online</OtwButton></div>
      </OtwCard>
    </OtwPageShell>
  );
}

