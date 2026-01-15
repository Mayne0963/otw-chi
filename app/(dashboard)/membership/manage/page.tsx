import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import OtwStatPill from '@/components/ui/otw/OtwStatPill';
import { getCurrentUser } from '@/lib/auth/roles';
import { getActiveSubscription } from '@/lib/membership';
import { createCheckoutSession, createCustomerPortal } from '@/app/actions/billing';

export const dynamic = 'force-dynamic';

export default async function MembershipManagePage() {
  const user = await getCurrentUser();
  if (!user) return <div>Please sign in</div>;

  const sub = await getActiveSubscription(user.id);
  // const planCode = getPlanCodeFromSubscription(sub);

  return (
    <OtwPageShell>
      <OtwSectionHeader title="Manage Membership" subtitle="Your plan and billing." />
      
      {sub ? (
        <Card className="mt-3 p-5 sm:p-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm font-medium opacity-70 uppercase tracking-wider">Current Plan</div>
              <div className="text-2xl font-bold mt-1 text-otwGold">{sub.plan?.name ?? 'No Plan'}</div>
              <div className="mt-2 text-sm opacity-80">
                Status: <OtwStatPill label="Status" value={sub.status} tone={sub.status === 'ACTIVE' ? 'success' : 'danger'} />
              </div>
              {sub.currentPeriodEnd && (
                <div className="mt-2 text-xs opacity-60">
                  Renews: {sub.currentPeriodEnd.toLocaleDateString()}
                </div>
              )}
            </div>
            <form action={createCustomerPortal}>
                <Button variant="outline">Manage Billing</Button>
            </form>
          </div>
        </Card>
      ) : (
        <div className="mt-3 grid md:grid-cols-3 gap-4">
            {/* Basic */}
            <Card className="p-5 sm:p-6">
                <div className="text-xl font-bold">Basic</div>
                <div className="text-2xl mt-2">$9<span className="text-sm opacity-60">/mo</span></div>
                <ul className="mt-4 text-sm space-y-2 opacity-80">
                    <li>• Standard Delivery</li>
                    <li>• 1.0x TIREM Rewards</li>
                </ul>
                <form action={async () => { 'use server'; await createCheckoutSession('BASIC'); }} className="mt-6">
                    <Button variant="outline" className="w-full">Choose Basic</Button>
                </form>
            </Card>

            {/* Plus */}
            <Card className="border-otwGold/50 p-5 sm:p-6">
                <div className="text-xl font-bold text-otwGold">Plus</div>
                <div className="text-2xl mt-2">$19<span className="text-sm opacity-60">/mo</span></div>
                <ul className="mt-4 text-sm space-y-2 opacity-80">
                    <li>• 10% Discount</li>
                    <li>• 1.25x TIREM Rewards</li>
                </ul>
                <form action={async () => { 'use server'; await createCheckoutSession('PLUS'); }} className="mt-6">
                    <Button variant="gold" className="w-full">Choose Plus</Button>
                </form>
            </Card>

            {/* Exec */}
            <Card className="p-5 sm:p-6">
                <div className="text-xl font-bold">Executive</div>
                <div className="text-2xl mt-2">$39<span className="text-sm opacity-60">/mo</span></div>
                <ul className="mt-4 text-sm space-y-2 opacity-80">
                    <li>• 20% Discount</li>
                    <li>• 2.0x TIREM Rewards</li>
                    <li>• No Service Fees</li>
                </ul>
                <form action={async () => { 'use server'; await createCheckoutSession('EXEC'); }} className="mt-6">
                    <Button variant="outline" className="w-full">Choose Exec</Button>
                </form>
            </Card>
        </div>
      )}
    </OtwPageShell>
  );
}
