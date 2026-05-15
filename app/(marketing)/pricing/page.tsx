import Link from 'next/link';
import PlanCheckoutButton from '@/components/membership/PlanCheckoutButton';
import BusinessPlansGrid from '@/components/membership/BusinessPlansGrid';
import OtwCard from '@/components/ui/otw/OtwCard';
import { Check } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { getConsumerPlanDisplayPerks } from '@/lib/membership-perks';
import OtwLeadCaptureCard from '@/components/analytics/OtwLeadCaptureCard';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const prisma = getPrisma();
  const user = await getCurrentUser();
  const customerProfile = user
    ? await prisma.customerProfile.findUnique({
        where: { userId: user.id },
        select: { phone: true },
      })
    : null;
  const stripeReady =
    Boolean(process.env.STRIPE_SECRET_KEY) && Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  const consumerPriceIds = {
    basic: process.env.STRIPE_PRICE_BASIC,
    plus: process.env.STRIPE_PRICE_PLUS,
    pro: process.env.STRIPE_PRICE_PRO,
    elite: process.env.STRIPE_PRICE_ELITE,
    black: process.env.STRIPE_PRICE_BLACK,
  } as const;

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

  const consumerPlans = [
    {
      name: 'OTW BASIC',
      code: 'basic' as const,
      price: '$99 / month',
      features: getConsumerPlanDisplayPerks('OTW BASIC'),
    },
    {
      name: 'OTW PLUS',
      code: 'plus' as const,
      price: '$169 / month',
      features: getConsumerPlanDisplayPerks('OTW PLUS'),
    },
    {
      name: 'OTW PRO',
      code: 'pro' as const,
      price: '$269 / month',
      features: getConsumerPlanDisplayPerks('OTW PRO'),
    },
    {
      name: 'OTW ELITE',
      code: 'elite' as const,
      price: '$429 / month',
      features: getConsumerPlanDisplayPerks('OTW ELITE'),
    },
    {
      name: 'OTW BLACK',
      code: 'black' as const,
      price: '$699 / month',
      features: getConsumerPlanDisplayPerks('OTW BLACK'),
    },
  ];

  const businessPlans = [
    {
      id: planMap.get('OTW BUSINESS CORE')?.id ?? null,
      name: 'OTW BUSINESS CORE',
      price: '$699 / month',
      features: ['Offices', 'Realtors', 'Clinics', 'Auto dealers'],
    },
    {
      id: planMap.get('OTW BUSINESS PRO')?.id ?? null,
      name: 'OTW BUSINESS PRO',
      price: '$1,199 / month',
      features: ['Priority dispatch', 'Dedicated rep', 'Custom rules'],
    },
    {
      id: planMap.get('OTW TRUE')?.id ?? null,
      name: 'OTW TRUE',
      price: 'Starting at $1,499 / month',
      features: [
        'Add/remove employees under one membership',
        'Free OTW BASIC home deliveries for all added employees',
        'Free job-site food delivery for employees',
        '2 free rides to/from work per employee each year',
        '2 free roadside assists to/from work per employee each year',
      ],
    },
    {
      id: planMap.get('OTW ENTERPRISE')?.id ?? null,
      name: 'OTW ENTERPRISE',
      price: 'Custom',
      features: ['Guaranteed response times', 'White-label potential', 'Multi-location support'],
    },
  ];

  function renderConsumerCards() {
    return (
      <div className="grid gap-6 md:grid-cols-3">
        {consumerPlans.map((plan) => {
          const record = planMap.get(plan.name);
          const hasCheckoutPrice = Boolean(consumerPriceIds[plan.code] || record?.stripePriceId);
          const planDisabled = !stripeReady || !hasCheckoutPrice;
          return (
            <OtwCard key={plan.code} className="relative flex flex-col">
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <h3 className="text-2xl font-semibold text-white">{plan.name}</h3>
                  <span className="text-lg text-white/60 whitespace-nowrap">{plan.price}</span>
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
        <p className="text-white/70">Flexible memberships for reliable delivery support.</p>
        <div className="pt-1">
          <Link
            href="/pricing/compare"
            className="inline-flex h-9 items-center rounded-md border border-white/20 bg-white/5 px-3 text-xs font-semibold text-white/85 hover:bg-white/10"
          >
            Compare Memberships
          </Link>
        </div>
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
        <BusinessPlansGrid
          plans={businessPlans}
          requesterDefaults={{
            fullName: user?.name ?? null,
            email: user?.email ?? null,
            phone: customerProfile?.phone ?? null,
          }}
        />
      </div>

      <div className="max-w-3xl mx-auto pt-2">
        <OtwLeadCaptureCard
          title="Ask About Memberships"
          subtitle="Not ready to subscribe yet? Leave your info and OTW will follow up."
          interestType="MEMBERSHIP_INTEREST"
          ctaLabel="Send Membership Interest"
          compact
        />
      </div>
    </div>
  );
}
