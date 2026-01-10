import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { getCurrentUser } from '@/lib/auth/roles';
import { syncUserOnDashboard } from '@/lib/user-sync';
import { getPrisma } from '@/lib/db';
import { getActiveSubscription, getPlanCodeFromSubscription, getMembershipBenefits } from '@/lib/membership';
import { LayoutDashboard, Wallet, CreditCard } from 'lucide-react';
import Link from 'next/link';

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

    const nip = await prisma.nIPLedger.aggregate({ where: { userId: user.id }, _sum: { amount: true } });
    nipBalance = nip._sum?.amount ?? 0;

    const req = await prisma.request.findFirst({
      where: { customerId: user.id, status: { in: ['SUBMITTED', 'ASSIGNED', 'PICKED_UP', 'DELIVERED'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (req) activeRequest = { id: req.id, status: req.status, pickup: req.pickup, dropoff: req.dropoff };
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" subtitle="Your OTW at-a-glance." />
        <EmptyState
          title="Sign in to view your dashboard"
          description="Access requests, membership and TIREM."
          action={{ label: "Sign In", href: "/sign-in" }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Your OTW at-a-glance." />
      
      <div className="grid md:grid-cols-3 gap-6">
        {/* Compliance Alert */}
        {/* @ts-ignore: Prisma types not updating */}
        {!user.dob && (
          <div className="md:col-span-3">
            <Card className="border-l-4 border-l-red-500 bg-red-900/10 border-t-0 border-r-0 border-b-0">
              <CardContent className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4">
                <div>
                  <div className="font-bold text-red-200">Profile Incomplete</div>
                  <div className="text-sm text-white/70">We need your Date of Birth to comply with age regulations.</div>
                </div>
                <Button asChild variant="destructive" size="sm">
                  <Link href="/settings">Update Profile</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-otwGold flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" /> Active Request
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeRequest ? (
              <div className="text-sm space-y-2">
                <div className="font-semibold text-white">{activeRequest.status}</div>
                <div className="text-white/70">{activeRequest.pickup} → {activeRequest.dropoff}</div>
                <Button asChild variant="outline" size="sm" className="w-full mt-2">
                  <Link href={`/requests/${activeRequest.id}`}>View Details</Link>
                </Button>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-xs text-white/50 mb-3">No active requests.</p>
                <Button asChild variant="secondary" size="sm" className="w-full">
                  <Link href="/requests/new">New Request</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-otwGold flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Membership
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">{membershipTier}</div>
            <div className="space-y-1">
              {membershipBenefits.discount > 0 && (
                <div className="text-xs text-white/70">Discount: {Math.round(membershipBenefits.discount * 100)}%</div>
              )}
              {membershipBenefits.nipMultiplier > 1 && (
                <div className="text-xs text-white/70">Multiplier: {membershipBenefits.nipMultiplier}x</div>
              )}
            </div>
            <Button asChild variant="outline" size="sm" className="w-full mt-2">
              <Link href="/membership/manage">Manage Plan</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-otwGold flex items-center gap-2">
              <Wallet className="h-4 w-4" /> TIREM Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{nipBalance.toLocaleString()}</div>
            <p className="text-xs text-white/50 mb-3">Available Rewards</p>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/wallet/nip">View Wallet</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
