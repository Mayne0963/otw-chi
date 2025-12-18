import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwStatPill from '@/components/ui/otw/OtwStatPill';
import OtwButton from '@/components/ui/otw/OtwButton';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { getCurrentUser } from '@/lib/auth/roles';
import { syncUserOnDashboard } from '@/lib/user-sync';
import { getPrisma } from '@/lib/db';
import { getActiveSubscription, getPlanCodeFromSubscription, getMembershipBenefits } from '@/lib/membership';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  await syncUserOnDashboard();
  const user = await getCurrentUser();
  let membershipTier = 'None';
  let nipBalance = 0;
  let activeRequest: { id: string; status: string; pickup: string; dropoff: string } | null = null;
  let membershipBenefits = getMembershipBenefits(null);

  if (user) {
    const prisma = getPrisma();
    
    // Get membership benefits
    const sub = await getActiveSubscription(user.id);
    const planCode = getPlanCodeFromSubscription(sub);
    membershipBenefits = getMembershipBenefits(planCode);
    membershipTier = sub?.plan?.name ?? 'None';

    const nip = await prisma.nIPLedger.aggregate({ where: { userId: user.id }, _sum: { amount: true } } as any);
    nipBalance = nip._sum?.amount ?? 0;

    const req = await prisma.request.findFirst({
      where: { customerId: user.id, status: { in: ['SUBMITTED', 'ASSIGNED', 'PICKED_UP', 'DELIVERED'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (req) activeRequest = { id: req.id, status: req.status, pickup: req.pickup, dropoff: req.dropoff };
  }

  return (
    <OtwPageShell>
      <OtwSectionHeader title="Dashboard" subtitle="Your OTW at-a-glance." />
      {!user ? (
        <OtwEmptyState
          title="Sign in to view your dashboard"
          subtitle="Access requests, membership and TIREM."
          actionHref="/sign-in"
          actionLabel="Sign In"
        />
      ) : (
        <div className="mt-3 grid md:grid-cols-3 gap-4">
          {/* Compliance Alert */}
          {/* @ts-ignore: Prisma types not updating */}
          {!user.dob && (
            <div className="md:col-span-3">
              <OtwCard className="border-l-4 border-l-red-500 bg-red-900/10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="font-bold text-red-200">Profile Incomplete</div>
                    <div className="text-sm opacity-80">We need your Date of Birth to comply with age regulations.</div>
                  </div>
                  <OtwButton as="a" href="/settings" variant="red" size="sm">Update Profile</OtwButton>
                </div>
              </OtwCard>
            </div>
          )}

          <OtwCard>
            <div className="text-sm font-medium">Active Request</div>
            {activeRequest ? (
              <div className="mt-2 text-sm opacity-90">
                <div>{activeRequest.status}</div>
                <div className="mt-1">{activeRequest.pickup} → {activeRequest.dropoff}</div>
                <div className="mt-3"><OtwButton as="a" href={`/requests/${activeRequest.id}`} variant="outline">View</OtwButton></div>
              </div>
            ) : (
              <OtwEmptyState title="No active request" subtitle="Start a new request to see tracking." actionHref="/requests/new" actionLabel="New Request" />
            )}
          </OtwCard>
          <OtwCard>
            <div className="text-sm font-medium">Membership</div>
            <div className="mt-2"><OtwStatPill label="Tier" value={membershipTier} tone="gold" /></div>
            {membershipBenefits.discount > 0 && (
              <div className="mt-2 text-sm opacity-80">Discount: {Math.round(membershipBenefits.discount * 100)}%</div>
            )}
            {membershipBenefits.nipMultiplier > 1 && (
              <div className="mt-1 text-sm opacity-80">TIREM Multiplier: {membershipBenefits.nipMultiplier}x</div>
            )}
            {membershipBenefits.waiveServiceFee && (
              <div className="mt-1 text-sm opacity-80">No Service Fees</div>
            )}
            <div className="mt-3"><OtwButton as="a" href="/membership/manage" variant="outline">Manage</OtwButton></div>
          </OtwCard>
          <OtwCard>
            <div className="text-sm font-medium">TIREM Balance</div>
            <div className="mt-2"><OtwStatPill label="TIREM" value={String(nipBalance)} tone="success" /></div>
            <div className="mt-3"><OtwButton as="a" href="/wallet/nip" variant="outline">View Wallet</OtwButton></div>
          </OtwCard>
        </div>
      )}
    </OtwPageShell>
  );
}
