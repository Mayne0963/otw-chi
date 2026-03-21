import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import PlanCheckoutButton from '@/components/membership/PlanCheckoutButton';
import { Check } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/roles';
import { getActiveSubscription } from '@/lib/membership';
import { getPrisma } from '@/lib/db';
import { getConsumerPlanDisplayPerks } from '@/lib/membership-perks';

export default async function MembershipPage() {
  const user = await getCurrentUser();
  const sub = user ? await getActiveSubscription(user.id) : null;
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
  const planNames = [
    'OTW BASIC',
    'OTW PLUS',
    'OTW PRO',
    'OTW ELITE',
    'OTW BLACK',
    'OTW BUSINESS CORE',
    'OTW BUSINESS PRO',
    'OTW TRUE',
    'OTW ENTERPRISE',
  ];
  const planRecords = await prisma.membershipPlan.findMany({
    where: { name: { in: planNames } },
  });
  const planMap = new Map(planRecords.map((plan) => [plan.name, plan]));

  const currentPlanName = sub?.plan?.name ?? null;

  const consumerPlans = [
    {
      name: 'OTW BASIC',
      code: 'basic' as const,
      price: '$99 / month',
      miles: 60,
      features: getConsumerPlanDisplayPerks('OTW BASIC'),
    },
    {
      name: 'OTW PLUS',
      code: 'plus' as const,
      price: '$169 / month',
      miles: 120,
      features: getConsumerPlanDisplayPerks('OTW PLUS'),
    },
    {
      name: 'OTW PRO',
      code: 'pro' as const,
      price: '$269 / month',
      miles: 200,
      features: getConsumerPlanDisplayPerks('OTW PRO'),
    },
    {
      name: 'OTW ELITE',
      code: 'elite' as const,
      price: '$429 / month',
      miles: 350,
      features: getConsumerPlanDisplayPerks('OTW ELITE'),
    },
    {
      name: 'OTW BLACK',
      code: 'black' as const,
      price: '$699 / month',
      miles: 600,
      features: getConsumerPlanDisplayPerks('OTW BLACK'),
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
      features: ['Up to 5 users', 'Rollover up to 250', 'Monthly invoice'],
    },
    {
      name: 'OTW BUSINESS PRO',
      price: '$1,199 / month',
      miles: 1_000,
      users: 'Up to 15',
      rollover: 'Rollover up to 500',
      billing: 'Monthly invoice',
      features: ['Up to 15 users', 'Rollover up to 500', 'Dedicated rep'],
    },
    {
      name: 'OTW TRUE',
      price: '$1,499 / month',
      miles: 1_200,
      users: 'Up to 50',
      rollover: 'Rollover up to 600',
      billing: 'Monthly invoice',
      features: [
        'Add and remove employees under one membership',
        'Each employee gets a free OTW BASIC home-delivery membership',
        'Free food delivery to the job site for all employees',
        '2 free rides to/from work per employee each year',
        '2 free roadside assists to/from work per employee each year',
      ],
    },
    {
      name: 'OTW ENTERPRISE',
      price: 'Custom',
      miles: 'Custom',
      users: 'Custom',
      rollover: 'Custom',
      billing: 'Contract / SLA',
      features: ['SLA contracts', 'Guaranteed response times', 'Multi-location support'],
    },
  ];

  return (
    <OtwPageShell>
      <OtwSectionHeader 
        title="Membership Plans" 
        subtitle="Upgrade your OTW experience with exclusive benefits." 
      />
      {!stripeReady && (
        <div className="mt-4 rounded-lg border border-amber-200/30 bg-amber-200/10 p-3 text-sm text-amber-100">
          Stripe is not fully configured in this environment. Plan checkout is disabled.
        </div>
      )}

      <div className="mt-6 space-y-6">
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Consumer</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {consumerPlans.map((plan) => {
              const record = planMap.get(plan.name);
              const isCurrent = Boolean(currentPlanName && plan.name === currentPlanName);
              const hasCheckoutPrice = Boolean(consumerPriceIds[plan.code] || record?.stripePriceId);
              const disabled = isCurrent || !stripeReady || !hasCheckoutPrice;

              return (
                <OtwCard
                  key={plan.code}
                  className={`relative flex flex-col ${isCurrent ? 'border-otwGold bg-otwGold/5' : ''}`}
                >
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-otwGold text-otwBlack px-3 py-1 rounded-full text-xs font-bold uppercase shadow-lg">
                        Current Plan
                      </span>
                    </div>
                  )}
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                      <span className="text-lg text-white/60">{plan.price}</span>
                    </div>
                    <div className="mb-4 text-xs text-white/70">
                      Service Miles: <span className="text-white">{plan.miles.toLocaleString()} / month</span>
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
                        priceId={record?.stripePriceId ?? consumerPriceIds[plan.code]}
                        className={`w-full ${isCurrent ? 'opacity-50 cursor-default' : ''}`}
                        disabled={disabled}
                      >
                        {isCurrent ? 'Active' : stripeReady ? 'Choose Plan' : 'Coming soon'}
                      </PlanCheckoutButton>
                    </div>
                  </div>
                </OtwCard>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Business</h2>
          <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-4">
            {businessPlans.map((plan) => (
              <OtwCard key={plan.name} className="relative flex h-full min-h-[540px] flex-col p-0 sm:p-0">
                <div className="flex h-full flex-col p-6">
                  <div className="mb-4 space-y-1">
                    <h3 className="text-[1.6rem] font-semibold leading-[1.1] tracking-tight text-white break-words">
                      {plan.name}
                    </h3>
                    <p className="text-base text-white/65">{plan.price}</p>
                  </div>

                  <div className="mb-5 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/75">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      <span>Service Miles</span>
                      <span className="text-right text-white">
                        {typeof plan.miles === 'number' ? plan.miles.toLocaleString() : plan.miles}
                      </span>
                      <span>Users</span>
                      <span className="text-right text-white">{plan.users}</span>
                      <span>Rollover</span>
                      <span className="text-right text-white">{plan.rollover}</span>
                      <span>Billing</span>
                      <span className="text-right text-white">{plan.billing}</span>
                    </div>
                  </div>

                  <ul className="mb-8 flex-1 space-y-2.5">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-otwGold shrink-0 mt-0.5" />
                        <span className="text-white/85 leading-6">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href="/contact"
                    className="mt-auto inline-flex h-11 w-full items-center justify-center rounded-md bg-otwGold px-4 text-sm font-medium text-otwBlack hover:bg-otwGold/90"
                  >
                    Request Invoice
                  </a>
                </div>
              </OtwCard>
            ))}
          </div>
        </div>
      </div>
    </OtwPageShell>
  );
}
