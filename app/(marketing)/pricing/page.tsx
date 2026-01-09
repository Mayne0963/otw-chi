import PlanCheckoutButton from '@/components/membership/PlanCheckoutButton';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { getPrisma } from '@/lib/db';

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
          <Card key={plan.code} className="relative flex flex-col">
            <Badge variant="secondary" className="absolute -top-3 left-1/2 -translate-x-1/2 bg-otwGold text-otwBlack hover:bg-otwGold">
              Popular
            </Badge>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {plan.name}
                <span className="text-lg text-white/60">{plan.price}</span>
              </CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-3">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-otwGold shrink-0 mt-0.5" />
                    <span className="text-white/80">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <PlanCheckoutButton
                plan={plan.code as 'basic' | 'plus' | 'executive'}
                planId={planId}
                priceId={priceId}
                disabled={planDisabled}
                className="w-full bg-otwGold text-otwBlack hover:bg-otwGold/90 disabled:opacity-60"
              >
                {planDisabled ? 'Coming soon' : 'Choose Plan'}
              </PlanCheckoutButton>
            </CardFooter>
          </Card>
          );
        })}
      </div>
    </div>
  );
}
