"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { getMembershipForCustomer, estimateRemainingMiles, getAllTiers } from '@/lib/otw/otwMembership';
import { getTierById } from '@/lib/otw/otwTierCatalog';

export default function MembershipPage() {
  const customerId = 'CUSTOMER-1';
  const membership = useMemo(() => getMembershipForCustomer(customerId), [customerId]);
  const [allTiers, setAllTiers] = useState<any[]>([]);
  const [selectedTierId, setSelectedTierId] = useState<string>('');
  const [changing, setChanging] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeSuccess, setChangeSuccess] = useState<string | null>(null);

  useEffect(() => {
    const tiers = getAllTiers?.() || [];
    setAllTiers(tiers);
  }, []);

  useEffect(() => {
    if (membership && !selectedTierId) {
      setSelectedTierId(String((membership as any).tierId));
    }
  }, [membership, selectedTierId]);

  const tier = membership ? getTierById((membership as any).tierId) : undefined;
  const remainingMiles = membership ? estimateRemainingMiles(membership) : 0;
  const renewSource = membership ? ((membership as any).renewsOn || (membership as any).renewsAtIso) : undefined;
  const renewDateLabel = renewSource ? new Date(renewSource).toLocaleDateString() : '—';

  const handleChangeTier = async () => {
    if (!selectedTierId) return;
    try {
      setChangeError(null);
      setChangeSuccess(null);
      setChanging(true);
      const res = await fetch('/api/otw/membership/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId: selectedTierId })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setChangeError(data.error || 'Unable to change membership tier.');
        return;
      }
      setChangeSuccess('Your OTW membership tier has been updated.');
    } catch (err) {
      console.error('Failed to change OTW membership tier:', err);
      setChangeError('Network error while changing membership tier.');
    } finally {
      setChanging(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Choose Your OTW Level</h1>
        <p className="text-otwOffWhite/80">From everyday runs to executive concierge, we got you.</p>
      </header>

      {/* Your Membership Snapshot */}
      <section className="bg-otwBlack rounded-2xl border border-otwRedDark p-5">
        <h3 className="text-lg font-semibold mb-2">Your OTW Membership</h3>
        {!membership ? (
          <p className="text-sm opacity-80">You don't have an active OTW membership yet. Once you pick a tier, your miles and perks will show up here.</p>
        ) : (
          <div className="space-y-3">
            <p className="font-semibold">{tier?.name ?? String((membership as any).tierId)}</p>
            {tier?.description && (<p className="text-sm opacity-80">{tier.description}</p>)}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="block text-xs opacity-70">Miles Cap</span>
                <span className="block text-base font-semibold">{(membership as any).milesCap?.toLocaleString?.() ?? '—'}</span>
              </div>
              <div>
                <span className="block text-xs opacity-70">Used</span>
                <span className="block text-base font-semibold">{(membership as any).milesUsed?.toLocaleString?.() ?? '—'}</span>
              </div>
              <div>
                <span className="block text-xs opacity-70">Rollover</span>
                <span className="block text-base font-semibold">{(membership as any).rolloverMiles?.toLocaleString?.() ?? '—'}</span>
              </div>
              <div>
                <span className="block text-xs opacity-70">Remaining*</span>
                <span className="block text-base font-semibold">{remainingMiles.toLocaleString()}</span>
              </div>
            </div>

            <p className="text-xs opacity-75">Status: <span className="font-semibold">{String((membership as any).status ?? 'ACTIVE')}</span> • Renews on <span className="font-semibold">{renewDateLabel}</span></p>

            {tier?.perks?.length ? (
              <div>
                <p className="text-sm font-semibold mb-1">Key Perks:</p>
                <ul className="list-disc pl-5 text-sm opacity-90">
                  {tier.perks.map((perk) => (
                    <li key={perk}>{perk}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-2 pt-2 border-t border-otwRedDark">
              <p className="text-sm font-medium mb-2">Change your OTW tier:</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  className="flex-1 text-sm rounded-xl bg-otwBlack border border-otwRedDark px-3 py-2"
                  value={selectedTierId}
                  onChange={(e) => setSelectedTierId(e.target.value)}
                  aria-label="Select OTW tier"
                >
                  {allTiers.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name} – {Number(t.includedMiles).toLocaleString()} miles / month
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="px-4 py-2 rounded-2xl bg-otwGold text-otwBlack font-semibold"
                  disabled={changing}
                  onClick={handleChangeTier}
                >
                  {changing ? 'Updating…' : 'Update Tier'}
                </button>
              </div>
              {changeError && <p className="text-sm text-otwRed mt-2">{changeError}</p>}
              {changeSuccess && <p className="text-sm text-otwGold mt-2">{changeSuccess}</p>}
              <p className="text-xs opacity-70 mt-2">*Remaining miles include your monthly cap plus any rollover.</p>
            </div>
          </div>
        )}
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        {/* Broski Basic */}
        <div className="bg-otwBlack rounded-2xl border border-otwRedDark p-5">
          <h3 className="text-lg font-semibold">Broski Basic</h3>
          <p className="text-sm opacity-80 mb-3">Pay as you go. Smart savings on every run.</p>
          <div className="text-3xl font-bold mb-2">$9<span className="text-base opacity-70">/mo</span></div>
          <ul className="list-disc pl-5 space-y-1 text-sm opacity-90">
            <li>Standard delivery rates</li>
            <li>NIP Coin rewards</li>
            <li>Email support</li>
          </ul>
          <button className="mt-4 w-full rounded-2xl px-4 py-2 border border-otwGold text-otwGold">Choose Plan</button>
        </div>

        {/* Broski+ */}
        <div className="rounded-2xl p-5 bg-gradient-to-b from-otwBlack to-otwRedDark shadow-otwSoft">
          <h3 className="text-lg font-semibold">Broski+</h3>
          <p className="text-sm opacity-80 mb-3">Lower delivery fees, priority drivers, NIP Coin multiplier.</p>
          <div className="text-3xl font-bold mb-2">$19<span className="text-base opacity-70">/mo</span></div>
          <ul className="list-disc pl-5 space-y-1 text-sm opacity-90">
            <li>Lower delivery fees</li>
            <li>Priority drivers</li>
            <li>NIP Coin multiplier</li>
          </ul>
          <button className="mt-4 w-full rounded-2xl px-4 py-2 bg-otwGold text-otwBlack font-semibold">Choose Plan</button>
        </div>

        {/* Executive Broski */}
        <div className="bg-otwRed rounded-2xl p-5 border border-otwGold shadow-otwGlow">
          <h3 className="text-lg font-semibold">Executive Broski</h3>
          <p className="text-sm opacity-90 mb-3">Concierge scheduling, VIP queue, free miles buffer, tripled NIP Coin.</p>
          <div className="text-3xl font-bold mb-2">$39<span className="text-base opacity-70">/mo</span></div>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Concierge scheduling</li>
            <li>VIP queue</li>
            <li>Free miles buffer</li>
            <li>Tripled NIP Coin</li>
          </ul>
          <button className="mt-4 w-full rounded-2xl px-4 py-2 bg-otwGold text-otwBlack font-semibold">Choose Plan</button>
        </div>
      </section>
    </div>
  );
}
