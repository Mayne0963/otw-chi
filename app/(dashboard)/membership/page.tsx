import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import PlanCheckoutButton from '@/components/membership/PlanCheckoutButton';
import { Check } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/roles';
import { getActiveSubscription, getPlanCodeFromSubscription } from '@/lib/membership';

export default async function MembershipPage() {
  const user = await getCurrentUser();
  const sub = user ? await getActiveSubscription(user.id) : null;
  const planCode = getPlanCodeFromSubscription(sub as any);
  const stripeReady =
    Boolean(process.env.STRIPE_SECRET_KEY) && Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

  const plans = [
    {
      code: 'basic',
      name: 'Basic',
      price: '$0',
      description: 'Standard access to OTW services.',
      features: ['Standard delivery fees', 'Basic support', 'Pay per request'],
    },
    {
      code: 'plus',
      name: 'Plus',
      price: '$9.99/mo',
      description: 'For frequent users who want to save.',
      features: ['20% off all deliveries', 'Priority support', '1.2x NIP Rewards'],
    },
    {
      code: 'executive',
      name: 'Executive',
      price: '$29.99/mo',
      description: 'The ultimate concierge experience.',
      features: ['Waived service fees', '24/7 Concierge line', '2x NIP Rewards', 'Priority dispatch'],
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

      <div className="grid gap-6 md:grid-cols-3 mt-6">
        {plans.map((plan) => {
          const isCurrent = plan.code === planCode;
          const disabled = isCurrent || !stripeReady;
          return (
            <OtwCard key={plan.code} className={`relative flex flex-col ${isCurrent ? 'border-otwGold bg-otwGold/5' : ''}`}>
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-otwGold text-otwBlack px-3 py-1 rounded-full text-xs font-bold uppercase shadow-lg">Current Plan</span>
                </div>
              )}
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
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
                    plan={plan.code.toLowerCase() as 'basic' | 'plus' | 'executive'}
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
    </OtwPageShell>
  );
}
