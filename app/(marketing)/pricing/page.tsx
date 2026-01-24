import PlanCheckoutButton from '@/components/membership/PlanCheckoutButton';
import OtwCard from '@/components/ui/otw/OtwCard';
import { Check } from 'lucide-react';
import { getPrisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const prisma = getPrisma();
  const planRecords = await prisma.membershipPlan.findMany();
  const planMap = new Map(planRecords.map((plan: { name: string }) => [plan.name.toLowerCase(), plan]));
  const stripeReady =
    Boolean(process.env.STRIPE_SECRET_KEY) && Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  const fallbackPriceIds = {
    basic: process.env.STRIPE_PRICE_BASIC,
    plus: process.env.STRIPE_PRICE_PLUS,
    executive: process.env.STRIPE_PRICE_EXEC,
  } as const;

  const plans = [
    {
      code: 'basic',
      name: 'Basic',
      price: '$0',
      description: 'Pay-as-you-go concierge delivery.',
      features: ['No monthly fee', 'Standard support', 'On-demand requests'],
    },
    {
      code: 'plus',
      name: 'Plus',
      price: '$9.99/mo',
      description: 'Best for regular users.',
      features: ['10% off deliveries', 'Priority support', 'Faster dispatch'],
    },
    {
      code: 'executive',
      name: 'Executive',
      price: '$29.99/mo',
      description: 'Premium concierge experience.',
      features: ['Service fee waived', '24/7 concierge', 'Priority dispatch'],
    },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold">Memberships</h1>
        <p className="text-white/70">Upgrade your OTW experience and save on every delivery.</p>
        {!stripeReady && (
          <p className="text-xs text-amber-200">
            Stripe checkout is not fully configured. Plans are view-only for now.
          </p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const planRecord = planMap.get(plan.name.toLowerCase());
          const priceId = (planRecord as any)?.stripePriceId ?? fallbackPriceIds[plan.code as keyof typeof fallbackPriceIds];
          const planId = (planRecord as any)?.id;
          const planDisabled = !stripeReady || !priceId;
          return (
          <OtwCard key={plan.code} className="relative flex flex-col">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-otwGold text-otwBlack px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase shadow-lg hover:bg-otwGold cursor-default">
              Popular
            </span>
            <div className="p-6 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-2xl font-semibold text-white">{plan.name}</h3>
                <span className="text-lg text-white/60">{plan.price}</span>
              </div>
              <p className="text-sm text-white/50 mb-6">{plan.description}</p>
              
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
                    plan={plan.code as 'basic' | 'plus' | 'executive'}
                    planId={planId}
                    priceId={priceId}
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
    </div>
  );
}
