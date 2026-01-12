import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { getCurrentUser } from '@/lib/auth/roles';
import { syncUserOnDashboard } from '@/lib/user-sync';
import { getPrisma } from '@/lib/db';
import { getActiveSubscription, getPlanCodeFromSubscription, getMembershipBenefits } from '@/lib/membership';
import { LayoutDashboard, Wallet, CreditCard, ArrowRight } from 'lucide-react';
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

    // Fetch latest from both tables
    const legacyReq = await prisma.request.findFirst({
      where: { customerId: user.id, status: { in: ['SUBMITTED', 'ASSIGNED', 'PICKED_UP', 'DELIVERED'] } },
      orderBy: { createdAt: 'desc' },
    });

    const newReq = await prisma.deliveryRequest.findFirst({
      where: { userId: user.id, status: { in: ['REQUESTED', 'ASSIGNED', 'PICKED_UP', 'EN_ROUTE', 'DELIVERED'] } },
      orderBy: { createdAt: 'desc' },
    });

    // Determine which is more recent
    if (newReq && (!legacyReq || newReq.createdAt > legacyReq.createdAt)) {
        activeRequest = { 
            id: newReq.id, 
            status: newReq.status.replace('_', ' '), 
            pickup: newReq.pickupAddress, 
            dropoff: newReq.dropoffAddress 
        };
    } else if (legacyReq) {
        activeRequest = { 
            id: legacyReq.id, 
            status: legacyReq.status.replace('_', ' '), 
            pickup: legacyReq.pickup, 
            dropoff: legacyReq.dropoff 
        };
    }
  }

  if (!user) {
    return (
      <OtwPageShell>
        <OtwSectionHeader title="Dashboard" subtitle="Your OTW at-a-glance." />
        <OtwCard className="mt-3">
          <OtwEmptyState
            title="Sign in to view your dashboard"
            subtitle="Access requests, membership and TIREM."
            actionLabel="Sign In"
            actionHref="/sign-in"
          />
        </OtwCard>
      </OtwPageShell>
    );
  }

  return (
    <OtwPageShell>
      <OtwSectionHeader title="Dashboard" subtitle="Your OTW at-a-glance." />
      
      <div className="grid md:grid-cols-3 gap-6 mt-6">
        {/* Compliance Alert */}
        {!user.dob && (
          <div className="md:col-span-3">
            <OtwCard className="border-l-4 border-l-red-500 bg-red-900/10 border-t-0 border-r-0 border-b-0 p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-red-200">Profile Incomplete</div>
                  <div className="text-sm text-white/70">We need your Date of Birth to comply with age regulations.</div>
                </div>
                <OtwButton as="a" href="/settings" variant="red" size="sm">
                  Update Profile
                </OtwButton>
              </div>
            </OtwCard>
          </div>
        )}

        <OtwCard className="p-6">
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
              <OtwButton as="a" href={`/track/${activeRequest.id}`} variant="gold" className="w-full">
                Track Order
              </OtwButton>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-white/50">No active requests</div>
              <OtwButton as="a" href="/order" variant="outline" className="w-full">
                New Order
              </OtwButton>
            </div>
          )}
        </OtwCard>

        <OtwCard className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="h-4 w-4 text-otwGold" />
            <h3 className="text-sm font-medium text-otwGold">TIREM Balance</h3>
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-2xl font-bold text-white">{nipBalance.toLocaleString()}</div>
              <div className="text-sm text-white/60 mt-1">Tokens Available</div>
            </div>
            <OtwButton as="a" href="/wallet/nip" variant="outline" className="w-full">
              Manage Wallet
            </OtwButton>
          </div>
        </OtwCard>

        <OtwCard className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-otwGold" />
            <h3 className="text-sm font-medium text-otwGold">Membership</h3>
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-2xl font-bold text-white">{membershipTier}</div>
              <div className="text-sm text-white/60 mt-1">Current Plan</div>
            </div>
            <OtwButton as="a" href="/membership" variant="outline" className="w-full">
              View Benefits
            </OtwButton>
          </div>
        </OtwCard>
      </div>

      <div className="mt-6">
        <OtwCard className="p-6">
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
        </OtwCard>
      </div>
    </OtwPageShell>
  );
}
