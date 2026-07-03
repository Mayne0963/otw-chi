'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import OtwCard from '@/components/ui/otw/OtwCard';
import BusinessMembershipInvoiceRequestDialog from '@/components/membership/BusinessMembershipInvoiceRequestDialog';

type BusinessPlan = {
  id?: string | null;
  name: string;
  price: string;
  features: string[];
};

type RequesterDefaults = {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
};

type BusinessPlansGridProps = {
  plans: BusinessPlan[];
  requesterDefaults?: RequesterDefaults;
};

export default function BusinessPlansGrid({ plans, requesterDefaults }: BusinessPlansGridProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="inline-flex h-9 items-center justify-center rounded-md border border-white/20 bg-white/5 px-3 text-xs font-medium text-white/85 hover:bg-white/10"
        >
          {expanded ? 'Use compact cards' : 'Enlarge cards'}
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-4">
        {plans.map((plan) => {
          const visibleFeatures = expanded ? plan.features : plan.features.slice(0, 2);
          const hiddenFeatureCount = Math.max(0, plan.features.length - visibleFeatures.length);

          return (
            <OtwCard
              key={plan.name}
              className={`relative flex h-full flex-col p-0 sm:p-0 ${
                expanded ? 'min-h-[540px]' : 'min-h-[410px]'
              }`}
            >
              <div className="flex h-full flex-col p-6">
                <div className="mb-4 space-y-1">
                  <h3 className="text-[1.6rem] font-semibold leading-[1.1] tracking-tight text-white break-words">
                    {plan.name}
                  </h3>
                  <p className="text-base text-white/65">{plan.price}</p>
                </div>

                <ul className={`flex-1 ${expanded ? 'mb-8 space-y-2.5' : 'mb-6 space-y-2'}`}>
                  {visibleFeatures.map((feature, index) => (
                    <li key={`${plan.name}-${index}`} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-otwGold" />
                      <span className={`text-white/85 ${expanded ? 'leading-6' : 'leading-5'}`}>{feature}</span>
                    </li>
                  ))}
                  {!expanded && hiddenFeatureCount > 0 ? (
                    <li className="pl-6 text-xs text-white/55">+{hiddenFeatureCount} more perks</li>
                  ) : null}
                </ul>

                <BusinessMembershipInvoiceRequestDialog
                  plan={{
                    id: plan.id ?? null,
                    name: plan.name,
                    price: plan.price,
                  }}
                  requesterDefaults={requesterDefaults}
                />
              </div>
            </OtwCard>
          );
        })}
      </div>
    </div>
  );
}
