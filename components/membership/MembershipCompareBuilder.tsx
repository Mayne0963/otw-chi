'use client';

import { useMemo, useState } from 'react';
import OtwCard from '@/components/ui/otw/OtwCard';
import { Plus, X } from 'lucide-react';

type PlanSection = 'consumer' | 'business';

export type MembershipComparePlan = {
  id: string;
  name: string;
  section: PlanSection;
  price: string;
  serviceMiles: string;
  rollover: string;
  users: string;
  billing: string;
  perks: string[];
};

type MembershipCompareBuilderProps = {
  plans: MembershipComparePlan[];
};

function toLabel(section: PlanSection): string {
  return section === 'business' ? 'Business' : 'Consumer';
}

export default function MembershipCompareBuilder({ plans }: MembershipCompareBuilderProps) {
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);

  const planById = useMemo(() => new Map(plans.map((plan) => [plan.id, plan])), [plans]);
  const planOrder = useMemo(() => plans.map((plan) => plan.id), [plans]);
  const sectionPlanIds = useMemo(
    () => ({
      consumer: plans.filter((plan) => plan.section === 'consumer').map((plan) => plan.id),
      business: plans.filter((plan) => plan.section === 'business').map((plan) => plan.id),
    }),
    [plans],
  );

  const selectedPlans = selectedPlanIds
    .map((id) => planById.get(id))
    .filter((plan): plan is MembershipComparePlan => Boolean(plan));

  function addPlan(planId: string) {
    const pickedPlan = planById.get(planId);
    if (!pickedPlan) return;

    setSelectedPlanIds((previous) => {
      const next = new Set(previous);
      const hasAnyInSection = previous.some((id) => planById.get(id)?.section === pickedPlan.section);

      if (!hasAnyInSection) {
        for (const id of sectionPlanIds[pickedPlan.section]) next.add(id);
      } else {
        next.add(planId);
      }

      return planOrder.filter((id) => next.has(id));
    });
  }

  function removePlan(planId: string) {
    setSelectedPlanIds((previous) => previous.filter((id) => id !== planId));
  }

  function addSection(section: PlanSection) {
    setSelectedPlanIds((previous) => {
      const next = new Set(previous);
      for (const id of sectionPlanIds[section]) next.add(id);
      return planOrder.filter((id) => next.has(id));
    });
  }

  function clearAll() {
    setSelectedPlanIds([]);
  }

  return (
    <div className="space-y-5">
      <OtwCard className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => addSection('consumer')}
            className="inline-flex h-9 items-center rounded-md border border-white/20 bg-white/5 px-3 text-xs font-semibold text-white/85 hover:bg-white/10"
          >
            Add Consumer Set
          </button>
          <button
            type="button"
            onClick={() => addSection('business')}
            className="inline-flex h-9 items-center rounded-md border border-white/20 bg-white/5 px-3 text-xs font-semibold text-white/85 hover:bg-white/10"
          >
            Add Business Set
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex h-9 items-center rounded-md border border-red-300/30 bg-red-500/10 px-3 text-xs font-semibold text-red-200 hover:bg-red-500/20"
          >
            Clear All
          </button>
        </div>

        <div className="text-xs text-white/60">
          Tip: selecting one plan auto-adds its section so you can compare full tiers quickly.
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => {
            const isSelected = selectedPlanIds.includes(plan.id);
            return (
              <div
                key={plan.id}
                className={`rounded-lg border p-3 ${
                  isSelected ? 'border-otwGold/50 bg-otwGold/10' : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{plan.name}</div>
                    <div className="mt-0.5 text-xs text-white/60">
                      {toLabel(plan.section)} · {plan.price}
                    </div>
                  </div>
                  {isSelected ? (
                    <button
                      type="button"
                      onClick={() => removePlan(plan.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-black/30 text-white/80 hover:bg-black/50"
                      aria-label={`Remove ${plan.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addPlan(plan.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-black/30 text-white/80 hover:bg-black/50"
                      aria-label={`Add ${plan.name}`}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </OtwCard>

      {selectedPlans.length < 2 ? (
        <OtwCard className="text-sm text-white/70">
          Select at least <span className="font-semibold text-white">2 memberships</span> to compare.
        </OtwCard>
      ) : (
        <OtwCard className="overflow-x-auto p-0 sm:p-0">
          <table className="min-w-[760px] w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="w-[220px] p-4 text-left text-xs uppercase tracking-[0.12em] text-white/50">
                  Feature
                </th>
                {selectedPlans.map((plan) => (
                  <th key={plan.id} className="p-4 text-left align-top">
                    <div className="text-base font-semibold text-white">{plan.name}</div>
                    <div className="mt-1 text-xs text-white/60">{toLabel(plan.section)}</div>
                    <div className="mt-1 text-sm text-otwGold">{plan.price}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-white/10">
                <td className="p-4 text-white/70">Service Miles</td>
                {selectedPlans.map((plan) => (
                  <td key={`${plan.id}-miles`} className="p-4 text-white">
                    {plan.serviceMiles}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-white/10">
                <td className="p-4 text-white/70">Rollover</td>
                {selectedPlans.map((plan) => (
                  <td key={`${plan.id}-rollover`} className="p-4 text-white">
                    {plan.rollover}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-white/10">
                <td className="p-4 text-white/70">Users</td>
                {selectedPlans.map((plan) => (
                  <td key={`${plan.id}-users`} className="p-4 text-white">
                    {plan.users}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-white/10">
                <td className="p-4 text-white/70">Billing</td>
                {selectedPlans.map((plan) => (
                  <td key={`${plan.id}-billing`} className="p-4 text-white">
                    {plan.billing}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 text-white/70">Included Perks</td>
                {selectedPlans.map((plan) => (
                  <td key={`${plan.id}-perks`} className="p-4 align-top">
                    <ul className="space-y-1.5 text-white/90">
                      {plan.perks.map((perk, index) => (
                        <li key={`${plan.id}-perk-${index}`} className="leading-5">
                          {perk}
                        </li>
                      ))}
                    </ul>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </OtwCard>
      )}
    </div>
  );
}

