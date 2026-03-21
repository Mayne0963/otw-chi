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
import { BillingSync } from '@/app/(dashboard)/billing/BillingSync';
import {
  addOtwTrueEmployeeAction,
  removeOtwTrueEmployeeAction,
} from '@/app/actions/otw-true';

export const dynamic = 'force-dynamic';

export default async function MembershipManagePage({
  searchParams,
}: {
  searchParams: Promise<{
    success?: string;
    canceled?: string;
    otwTrueSuccess?: string;
    otwTrueError?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <div>Please sign in</div>;
  const { success, canceled, otwTrueSuccess, otwTrueError } = await searchParams;
  const checkoutSuccess = success === '1' || success === 'true';
  const checkoutCanceled = canceled === '1' || canceled === 'true';

  const sub = await getActiveSubscription(user.id);
  const stripeReady =
    Boolean(process.env.STRIPE_SECRET_KEY) && Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  const consumerPriceIds = {
    basic: process.env.STRIPE_PRICE_BASIC,
    plus: process.env.STRIPE_PRICE_PLUS,
    pro: process.env.STRIPE_PRICE_PRO,
    elite: process.env.STRIPE_PRICE_ELITE,
    black: process.env.STRIPE_PRICE_BLACK,
  } as const;
  const prisma = getPrisma();
  const planNames = ['OTW BASIC', 'OTW PLUS', 'OTW PRO', 'OTW ELITE', 'OTW BLACK'];
  const planRecords = await prisma.membershipPlan.findMany({
    where: { name: { in: planNames } },
  });
  const planMap = new Map(planRecords.map((plan) => [plan.name, plan]));
  const isOtwTrueOwner = sub?.plan?.name?.trim().toUpperCase() === 'OTW TRUE';
  const currentBenefitYear = new Date().getFullYear();
  const otwTrueEmployees = isOtwTrueOwner
    ? await prisma.otwTrueEmployee.findMany({
        where: { ownerUserId: user.id },
        include: {
          yearlyBenefits: {
            where: { benefitYear: currentBenefitYear },
            select: {
              freeFoodDeliveriesUsed: true,
              commuteRidesUsed: true,
              roadsideAssistsUsed: true,
            },
            take: 1,
          },
          employeeUser: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      })
    : [];

  const consumerPlans = [
    { name: 'OTW BASIC', code: 'basic' as const, label: '$99 / month • 60 miles' },
    { name: 'OTW PLUS', code: 'plus' as const, label: '$169 / month • 120 miles' },
    { name: 'OTW PRO', code: 'pro' as const, label: '$269 / month • 200 miles' },
    { name: 'OTW ELITE', code: 'elite' as const, label: '$429 / month • 350 miles' },
    { name: 'OTW BLACK', code: 'black' as const, label: '$699 / month • 600 miles' },
  ];

  return (
    <OtwPageShell>
      <BillingSync success={checkoutSuccess} />
      <OtwSectionHeader title="Manage Membership" subtitle="Your plan and billing." />
      {checkoutSuccess && (
        <div className="mt-4 rounded-lg border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-500">
          Subscription successful. Activating your membership now.
        </div>
      )}
      {checkoutCanceled && (
        <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
          Subscription checkout was canceled.
        </div>
      )}
      {otwTrueSuccess ? (
        <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          {otwTrueSuccess}
        </div>
      ) : null}
      {otwTrueError ? (
        <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          {otwTrueError}
        </div>
      ) : null}
      
      {sub ? (
        <div className="mt-3 space-y-4">
          <Card className="p-5 sm:p-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm font-medium opacity-70 uppercase tracking-wider">Current Plan</div>
                <div className="text-2xl font-bold mt-1 text-otwGold">{sub.plan?.name ?? 'No Plan'}</div>
                <div className="mt-2 text-sm opacity-80">
                  Status:{' '}
                  <OtwStatPill
                    label="Status"
                    value={sub.status}
                    tone={sub.status === 'ACTIVE' ? 'success' : 'danger'}
                  />
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

          {isOtwTrueOwner ? (
            <Card className="p-5 sm:p-6">
              <div className="space-y-4">
                <div>
                  <div className="text-lg font-semibold text-white">OTW True Employees</div>
                  <div className="text-sm text-white/65">
                    Manage employees with OTW BASIC home access plus annual commute and roadside benefits.
                  </div>
                </div>

                <form action={addOtwTrueEmployeeAction} className="grid gap-3 md:grid-cols-[1.2fr_1fr_auto]">
                  <input
                    type="email"
                    name="employeeEmail"
                    required
                    placeholder="employee@company.com"
                    className="h-10 rounded-md border border-white/15 bg-black/30 px-3 text-sm text-white"
                  />
                  <input
                    type="text"
                    name="employeeName"
                    placeholder="Employee name (optional)"
                    className="h-10 rounded-md border border-white/15 bg-black/30 px-3 text-sm text-white"
                  />
                  <Button type="submit" className="h-10">
                    Add Employee
                  </Button>
                </form>

                {otwTrueEmployees.length > 0 ? (
                  <div className="space-y-3">
                    {otwTrueEmployees.map((employee) => {
                      const usage = employee.yearlyBenefits[0] ?? {
                        freeFoodDeliveriesUsed: 0,
                        commuteRidesUsed: 0,
                        roadsideAssistsUsed: 0,
                      };

                      return (
                        <div
                          key={employee.id}
                          className="rounded-lg border border-white/10 bg-black/25 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="font-medium text-white">
                                {employee.employeeName ||
                                  employee.employeeUser?.name ||
                                  employee.employeeEmail}
                              </div>
                              <div className="text-xs text-white/60">
                                {employee.employeeEmail}
                                {!employee.isActive ? ' • Removed' : ''}
                              </div>
                            </div>
                            {employee.isActive ? (
                              <form action={removeOtwTrueEmployeeAction}>
                                <input type="hidden" name="employeeId" value={employee.id} />
                                <Button type="submit" variant="outline" className="h-8 text-xs">
                                  Remove
                                </Button>
                              </form>
                            ) : null}
                          </div>
                          <div className="mt-3 grid gap-2 text-xs text-white/70 sm:grid-cols-3">
                            <div>
                              Free food deliveries ({currentBenefitYear}):{' '}
                              <span className="text-white">{usage.freeFoodDeliveriesUsed}</span>
                            </div>
                            <div>
                              Commute rides remaining:{' '}
                              <span className="text-white">
                                {Math.max(0, 2 - usage.commuteRidesUsed)}
                              </span>
                            </div>
                            <div>
                              Roadside assists remaining:{' '}
                              <span className="text-white">
                                {Math.max(0, 2 - usage.roadsideAssistsUsed)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-white/10 bg-black/25 p-4 text-sm text-white/65">
                    No employees added yet.
                  </div>
                )}
              </div>
            </Card>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            {consumerPlans.map((plan) => {
              const record = planMap.get(plan.name);
              const hasCheckoutPrice = Boolean(consumerPriceIds[plan.code] || record?.stripePriceId);
              const disabled = !stripeReady || !hasCheckoutPrice;
              return (
                <Card key={plan.code} className="p-5 sm:p-6">
                  <div className="text-xl font-bold">{plan.name}</div>
                  <div className="text-sm opacity-70 mt-1">{plan.label}</div>
                  <div className="mt-6">
                    <PlanCheckoutButton
                      plan={plan.code}
                      planId={record?.id}
                      priceId={record?.stripePriceId ?? consumerPriceIds[plan.code]}
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
