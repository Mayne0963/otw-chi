import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { createCustomerPortal } from '@/app/actions/billing';
import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ success?: string, canceled?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return <div>Please log in</div>;

  const prisma = getPrisma();
  const membership = await prisma.membershipSubscription.findUnique({
    where: { userId: user.id },
    include: { plan: true },
  });

  const { success, canceled } = await searchParams;
  const isActive = membership?.status === 'ACTIVE' || membership?.status === 'TRIALING';
  const planName = membership?.plan?.name || (membership?.stripePriceId ? 'Custom Plan' : 'Basic');
  const statusLabel = membership?.status ? membership.status.replace('_', ' ') : 'Inactive';

  return (
    <OtwPageShell>
        <OtwSectionHeader title="Billing & Membership" subtitle="Manage your subscription." />
        
        {success && (
            <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 text-green-500 rounded-lg">
                Subscription successful! Welcome to OTW.
            </div>
        )}
        
        {canceled && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg">
                Subscription canceled.
            </div>
        )}

        <OtwCard className="mt-6">
            <div className="p-4 border-b border-white/10 mb-4">
                <h3 className="text-lg font-medium text-white">Current Plan</h3>
                <p className="text-sm text-white/50">Your membership status</p>
            </div>
            <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <span className="text-white/70">Status</span>
                    <span className={`px-2.5 py-0.5 rounded text-xs font-medium uppercase ${isActive ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/60'}`}>
                        {statusLabel}
                    </span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-white/70">Plan</span>
                    <span className="font-semibold text-sm text-white">{planName}</span> 
                </div>
                {membership?.currentPeriodEnd && (
                    <div className="flex items-center justify-between text-sm text-white/50">
                        <span>Renews</span>
                        <span>{membership.currentPeriodEnd.toLocaleDateString()}</span>
                    </div>
                )}
                
                <div className="pt-4 mt-4 border-t border-white/10">
                  <form action={createCustomerPortal}>
                    <OtwButton type="submit" variant="outline" className="w-full">
                      Manage Subscription
                    </OtwButton>
                  </form>
                </div>
            </div>
        </OtwCard>
    </OtwPageShell>
  );
}
