import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwStatPill from '@/components/ui/otw/OtwStatPill';
import OtwButton from '@/components/ui/otw/OtwButton';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { getCurrentUser } from '@/lib/auth/roles';

export default async function DashboardPage() {
  let user = null;
  try { user = await getCurrentUser(); } catch { user = null; }
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Dashboard" subtitle="Your OTW at-a-glance." />
      {!user ? (
        <OtwEmptyState
          title="Sign in to view your dashboard"
          subtitle="Access requests, membership and NIP."
          actionHref="/sign-in"
          actionLabel="Sign In"
        />
      ) : (
        <div className="mt-3 grid md:grid-cols-3 gap-4">
          <OtwCard>
            <div className="text-sm font-medium">Active Request</div>
            <OtwEmptyState title="No active request" subtitle="Start a new request to see tracking." actionHref="/requests/new" actionLabel="New Request" />
          </OtwCard>
          <OtwCard>
            <div className="text-sm font-medium">Membership</div>
            <div className="mt-2"><OtwStatPill label="Tier" value="Basic" tone="gold" /></div>
            <div className="mt-3"><OtwButton as="a" href="/membership/manage" variant="outline">Manage</OtwButton></div>
          </OtwCard>
          <OtwCard>
            <div className="text-sm font-medium">NIP Balance</div>
            <div className="mt-2"><OtwStatPill label="NIP" value="0" tone="success" /></div>
            <div className="mt-3"><OtwButton as="a" href="/wallet/nip" variant="outline">View Wallet</OtwButton></div>
          </OtwCard>
        </div>
      )}
    </OtwPageShell>
  );
}

