import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import PlanCheckoutButton from '@/components/membership/PlanCheckoutButton';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/roles';
import { getActiveSubscription, getPlanCodeFromSubscription } from '@/lib/membership';

export default async function MembershipPage() {
  const user = await getCurrentUser();
  const sub = user ? await getActiveSubscription(user.id) : null;
  const planCode = getPlanCodeFromSubscription(sub);

  const plans = [
    {
      code: 'FREE',
      name: 'Free',
      price: '$0',
      description: 'Standard access to OTW services.',
      features: ['Standard delivery fees', 'Basic support', 'Pay per request'],
    },
    {
      code: 'PRO',
      name: 'Pro',
      price: '$9.99/mo',
      description: 'For frequent users who want to save.',
      features: ['20% off all deliveries', 'Priority support', '1.2x NIP Rewards'],
    },
    {
      code: 'EXECUTIVE',
      name: 'Executive',
      price: '$29.99/mo',
      description: 'The ultimate concierge experience.',
      features: ['Waived service fees', '24/7 Concierge line', '2x NIP Rewards', 'Priority dispatch'],
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader 
        title="Membership Plans" 
        subtitle="Upgrade your OTW experience with exclusive benefits." 
      />

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.code === planCode;
          return (
            <Card key={plan.code} className={`relative flex flex-col ${isCurrent ? 'border-otwGold bg-otwGold/5' : ''}`}>
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="secondary" className="bg-otwGold text-otwBlack hover:bg-otwGold">Current Plan</Badge>
                </div>
              )}
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
                  plan={plan.code.toLowerCase() as 'basic' | 'plus' | 'executive'}
                  className={`w-full ${isCurrent ? 'opacity-50 cursor-default' : 'bg-otwGold text-otwBlack hover:bg-otwGold/90'}`}
                  disabled={isCurrent}
                >
                  {isCurrent ? 'Active' : 'Choose Plan'}
                </PlanCheckoutButton>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
