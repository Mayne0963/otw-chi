import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { getCurrentUser } from '@/lib/auth/roles';
import { syncUserOnDashboard } from '@/lib/user-sync';
import { getPrisma } from '@/lib/db';
import { getActiveSubscription } from '@/lib/membership';
import { UNLIMITED_SERVICE_MILES } from '@/lib/membership-miles';
import { LayoutDashboard, Wallet, CreditCard, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  await syncUserOnDashboard();
  const user = await getCurrentUser();
  let membershipTier = 'None';
  let serviceMilesBalance = '0';
  let activeRequest: { id: string; status: string; pickup: string; dropoff: string } | null = null;

  if (user) {
    const prisma = getPrisma();
    
    const sub = await getActiveSubscription(user.id);
    membershipTier = sub?.plan?.name ?? 'None';

    const wallet = await prisma.serviceMilesWallet.findUnique({
      where: { userId: user.id },
      select: { balanceMiles: true },
    });
    if (wallet?.balanceMiles === UNLIMITED_SERVICE_MILES) {
      serviceMilesBalance = 'Unlimited';
    } else {
      serviceMilesBalance = String(wallet?.balanceMiles ?? 0);
    }

    const newReq = await prisma.deliveryRequest.findFirst({
      where: { userId: user.id, status: { in: ['REQUESTED', 'ASSIGNED', 'PICKED_UP', 'EN_ROUTE'] } },
      orderBy: { createdAt: 'desc' },
    });

    if (newReq) {
        activeRequest = { 
            id: newReq.id, 
            status: newReq.status.replace('_', ' '), 
            pickup: newReq.pickupAddress, 
            dropoff: newReq.dropoffAddress 
        };
    }
  }

  if (!user) {
    return (
      <OtwPageShell>
        <OtwSectionHeader title="Dashboard" subtitle="Your OTW at-a-glance." />
        <Card className="mt-3 p-5 sm:p-6">
          <OtwEmptyState
            title="Sign in to view your dashboard"
            subtitle="Access requests, membership, and Service Miles."
            actionLabel="Sign In"
            actionHref="/sign-in"
          />
        </Card>
      </OtwPageShell>
    );
  }

  return (
    <OtwPageShell>
      <OtwSectionHeader title="Dashboard" subtitle="Your OTW at-a-glance." />
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <LayoutDashboard className="h-4 w-4 text-otwGold" />
            <h3 className="text-sm font-medium text-otwGold">Active Request</h3>
          </div>
          {activeRequest ? (
            <div className="space-y-4">
              <div>
                <div className="text-2xl font-bold text-white capitalize">{activeRequest.status.toLowerCase()}</div>
                <div className="text-sm text-white/60 truncate mt-1">To: {activeRequest.dropoff}</div>
              </div>
              <Button asChild variant="gold" className="w-full">
                <Link href={`/track/${activeRequest.id}`}>
                  Track Order
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-white/50">No active requests</div>
              <Button asChild variant="outline" className="w-full">
                <Link href="/order">
                  New Order
                </Link>
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="h-4 w-4 text-otwGold" />
            <h3 className="text-sm font-medium text-otwGold">Service Miles Wallet</h3>
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-2xl font-bold text-white">{serviceMilesBalance}</div>
              <div className="text-sm text-white/60 mt-1">Miles Available</div>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link href="/service-miles">
                Manage Wallet
              </Link>
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-otwGold" />
            <h3 className="text-sm font-medium text-otwGold">Membership</h3>
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-2xl font-bold text-white">{membershipTier}</div>
              <div className="text-sm text-white/60 mt-1">Current Plan</div>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link href="/membership">
                View Benefits
              </Link>
            </Button>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/order" className="flex flex-col items-center justify-center p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5 hover:border-otwGold/50 group">
              <div className="h-10 w-10 rounded-full bg-otwGold/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <ArrowRight className="h-5 w-5 text-otwGold" />
              </div>
              <span className="text-sm font-medium text-white">Order Ride</span>
            </Link>
            <Link href="/order" className="flex flex-col items-center justify-center p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5 hover:border-otwGold/50 group">
              <div className="h-10 w-10 rounded-full bg-otwGold/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <ArrowRight className="h-5 w-5 text-otwGold" />
              </div>
              <span className="text-sm font-medium text-white">Delivery</span>
            </Link>
            <Link href="/membership" className="flex flex-col items-center justify-center p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5 hover:border-otwGold/50 group">
              <div className="h-10 w-10 rounded-full bg-otwGold/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <CreditCard className="h-5 w-5 text-otwGold" />
              </div>
              <span className="text-sm font-medium text-white">Membership</span>
            </Link>
            <Link href="/support" className="flex flex-col items-center justify-center p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5 hover:border-otwGold/50 group">
              <div className="h-10 w-10 rounded-full bg-otwGold/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <LayoutDashboard className="h-5 w-5 text-otwGold" />
              </div>
              <span className="text-sm font-medium text-white">Support</span>
            </Link>
          </div>
        </Card>
      </div>
    </OtwPageShell>
  );
}
