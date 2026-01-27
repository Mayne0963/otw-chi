import PlanCheckoutButton from '@/components/membership/PlanCheckoutButton';
import OtwCard from '@/components/ui/otw/OtwCard';
import { Check } from 'lucide-react';
import { getPrisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const prisma = getPrisma();
  const stripeReady =
    Boolean(process.env.STRIPE_SECRET_KEY) && Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

  const planNames = [
    'OTW BASIC',
    'OTW PLUS',
    'OTW PRO',
    'OTW ELITE',
    'OTW BLACK',
    'OTW BUSINESS CORE',
    'OTW BUSINESS PRO',
    'OTW ENTERPRISE',
  ];
  const planRecords = await prisma.membershipPlan.findMany({
    where: { name: { in: planNames } },
  });
  const planMap = new Map(planRecords.map((plan) => [plan.name, plan]));

  const consumerPlans = [
    {
      name: 'OTW BASIC',
      code: 'basic' as const,
      price: '$99 / month',
      miles: 60,
      rollover: 'No rollover',
      markupFree: false,
      cashPay: false,
      features: ['Food', 'Groceries', 'Quick errands'],
    },
    {
      name: 'OTW PLUS',
      code: 'plus' as const,
      price: '$169 / month',
      miles: 120,
      rollover: 'Rollover up to 30',
      markupFree: false,
      cashPay: false,
      features: ['Multi-stop', 'Longer waits', 'Light priority'],
    },
    {
      name: 'OTW PRO',
      code: 'pro' as const,
      price: '$269 / month',
      miles: 200,
      rollover: 'Rollover up to 75',
      markupFree: true,
      cashPay: false,
      features: ['Returns & exchanges', 'Sit-and-wait', 'No item markups', 'Priority routing'],
    },
    {
      name: 'OTW ELITE',
      code: 'elite' as const,
      price: '$429 / month',
      miles: 350,
      rollover: 'Rollover up to 150',
      markupFree: true,
      cashPay: true,
      features: ['Peer-to-peer delivery', 'Long sit & wait', 'Reduced mile rates per task', 'Priority support'],
    },
    {
      name: 'OTW BLACK',
      code: 'black' as const,
      price: '$699 / month',
      miles: 600,
      rollover: 'Unlimited rollover',
      markupFree: true,
      cashPay: true,
      features: ['Same rep when possible', 'Emergency requests', 'Zero delivery fees', 'Handle it mode'],
    },
  ];

  const businessPlans = [
    {
      name: 'OTW BUSINESS CORE',
      price: '$699 / month',
      miles: 500,
      users: 'Up to 5',
      rollover: 'Rollover up to 250',
      billing: 'Monthly invoice',
      features: ['Offices', 'Realtors', 'Clinics', 'Auto dealers'],
    },
    {
      name: 'OTW BUSINESS PRO',
      price: '$1,199 / month',
      miles: 1_000,
      users: 'Up to 15',
      rollover: 'Rollover up to 500',
      billing: 'Monthly invoice',
      features: ['Priority dispatch', 'Dedicated rep', 'Custom rules'],
    },
    {
      name: 'OTW ENTERPRISE',
      price: 'Custom',
      miles: 'Custom',
      users: 'Custom',
      rollover: 'Custom',
      billing: 'Contract / SLA',
      features: ['Guaranteed response times', 'White-label potential', 'Multi-location support'],
    },
  ];

  function renderConsumerCards() {
    return (
      <div className="grid gap-6 md:grid-cols-3">
        {consumerPlans.map((plan) => {
          const record = planMap.get(plan.name);
          const planDisabled = !stripeReady || !record?.stripePriceId;
          return (
            <OtwCard key={plan.code} className="relative flex flex-col">
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-2xl font-semibold text-white">{plan.name}</h3>
                  <span className="text-lg text-white/60">{plan.price}</span>
                </div>

                <div className="mb-5 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
                  <div className="flex items-center justify-between">
                    <span>Service Miles</span>
                    <span className="text-white">{plan.miles.toLocaleString()} / month</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span>Rollover</span>
                    <span className="text-white">{plan.rollover}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span>Markup-Free</span>
                    <span className="text-white">{plan.markupFree ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span>Cash Pay</span>
                    <span className="text-white">{plan.cashPay ? 'Yes' : 'No'}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-otwGold shrink-0 mt-0.5" />
                      <span className="text-white/80">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  <PlanCheckoutButton
                    plan={plan.code}
                    planId={record?.id}
                    priceId={record?.stripePriceId ?? undefined}
                    disabled={planDisabled}
                    className="w-full"
                  >
                    {planDisabled ? 'Coming soon' : 'Choose Plan'}
                  </PlanCheckoutButton>
                </div>
              </div>
            </OtwCard>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold">Membership Plans</h1>
        <p className="text-white/70">Life doesn’t charge by the mile. Neither do we.</p>
        {!stripeReady && (
          <p className="text-xs text-amber-200">
            Stripe checkout is not fully configured. Plans are view-only for now.
          </p>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Consumer</h2>
        {renderConsumerCards()}
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Business</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {businessPlans.map((plan) => (
            <OtwCard key={plan.name} className="relative flex flex-col">
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-2xl font-semibold text-white">{plan.name}</h3>
                  <span className="text-lg text-white/60">{plan.price}</span>
                </div>
                <div className="mb-5 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
                  <div className="flex items-center justify-between">
                    <span>Service Miles</span>
                    <span className="text-white">{typeof plan.miles === 'number' ? plan.miles.toLocaleString() : plan.miles}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span>Users</span>
                    <span className="text-white">{plan.users}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span>Rollover</span>
                    <span className="text-white">{plan.rollover}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span>Billing</span>
                    <span className="text-white">{plan.billing}</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-otwGold shrink-0 mt-0.5" />
                      <span className="text-white/80">{feature}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="/contact"
                  className="mt-auto inline-flex h-10 items-center justify-center rounded-md bg-otwGold px-4 text-sm font-medium text-otwBlack hover:bg-otwGold/90"
                >
                  Request Invoice
                </a>
              </div>
            </OtwCard>
          ))}
        </div>
      </div>
    </div>
  );
}
