import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import OtwStatPill from '@/components/ui/otw/OtwStatPill';
import { getCurrentUser } from '@/lib/auth/roles';
import { getActiveSubscription } from '@/lib/membership';
import { createCustomerPortal } from '@/app/actions/billing';
import { getPrisma } from '@/lib/db';
import PlanCheckoutButton from '@/components/membership/PlanCheckoutButton';

export const dynamic = 'force-dynamic';

export default async function MembershipManagePage() {
  const user = await getCurrentUser();
  if (!user) return <div>Please sign in</div>;

  const sub = await getActiveSubscription(user.id);
  const prisma = getPrisma();
  const planNames = ['OTW BASIC', 'OTW PLUS', 'OTW PRO', 'OTW ELITE', 'OTW BLACK'];
  const planRecords = await prisma.membershipPlan.findMany({
    where: { name: { in: planNames } },
  });
  const planMap = new Map(planRecords.map((plan) => [plan.name, plan]));

  const consumerPlans = [
    { name: 'OTW BASIC', code: 'basic' as const, label: '$99 / month • 60 miles' },
    { name: 'OTW PLUS', code: 'plus' as const, label: '$169 / month • 120 miles' },
    { name: 'OTW PRO', code: 'pro' as const, label: '$269 / month • 200 miles' },
    { name: 'OTW ELITE', code: 'elite' as const, label: '$429 / month • 350 miles' },
    { name: 'OTW BLACK', code: 'black' as const, label: '$699 / month • 600 miles' },
  ];

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
        <div className="mt-3 space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            {consumerPlans.map((plan) => {
              const record = planMap.get(plan.name);
              const disabled = !record?.stripePriceId;
              return (
                <Card key={plan.code} className="p-5 sm:p-6">
                  <div className="text-xl font-bold">{plan.name}</div>
                  <div className="text-sm opacity-70 mt-1">{plan.label}</div>
                  <div className="mt-6">
                    <PlanCheckoutButton
                      plan={plan.code}
                      planId={record?.id}
                      priceId={record?.stripePriceId ?? undefined}
                      disabled={disabled}
                      className="w-full"
                    >
                      {disabled ? 'Coming soon' : 'Choose Plan'}
                    </PlanCheckoutButton>
                  </div>
                </Card>
              );
            })}
          </div>

          <Card className="p-5 sm:p-6">
            <div className="text-xl font-bold">Business plans</div>
            <div className="text-sm opacity-70 mt-1">Invoice billing with reliability-first dispatch.</div>
            <div className="mt-6">
              <a
                href="/contact"
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-otwGold px-4 text-sm font-medium text-otwBlack hover:bg-otwGold/90"
              >
                Request Invoice
              </a>
            </div>
          </Card>
        </div>
      )}
    </OtwPageShell>
  );
}
