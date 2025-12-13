"use client";
import React, { useMemo, useState } from 'react';
import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import OtwStatPill from '@/components/ui/otw/OtwStatPill';

export default function CustomerRequestPage() {
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [service, setService] = useState('Food Pickup');
  const [notes, setNotes] = useState('');

  const estimates = useMemo(() => {
    const baseFee = 5;
    const perMile = 1.5;
    const hasBoth = pickup.trim() && dropoff.trim();
    const miles = hasBoth ? 4.2 : 0;
    const cost = hasBoth ? Math.round((baseFee + miles * perMile) * 100) / 100 : 0;
    const nip = hasBoth ? Math.floor(cost * 2) : 0;
    return { miles, cost, nip };
  }, [pickup, dropoff]);

  const handleSubmit = () => {
    alert('Request received – OTW is on the way.');
  };

  return (
    <OtwPageShell
      header={<OtwSectionHeader title="What You Need Today?" subtitle="Tell OTW where to go and we’ll handle the rest." />}
    >
      <div className="grid md:grid-cols-3 gap-4">
        <OtwCard className="md:col-span-2 space-y-4">
          <div className="space-y-1">
            <label className="text-sm">Pickup Location</label>
            <input
              value={pickup}
              onChange={e=>setPickup(e.target.value)}
              className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-otwGold focus:border-otwGold"
              placeholder="123 Broski Ave"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm">Dropoff Location</label>
            <input
              value={dropoff}
              onChange={e=>setDropoff(e.target.value)}
              className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-otwGold focus:border-otwGold"
              placeholder="456 Executive St"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm">Service Type</label>
            <select
              value={service}
              onChange={e=>setService(e.target.value)}
              className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-otwGold focus:border-otwGold"
            >
              <option>Food Pickup</option>
              <option>Store / Grocery</option>
              <option>Fragile Delivery</option>
              <option>Custom Concierge</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm">Notes to Driver</label>
            <textarea
              value={notes}
              onChange={e=>setNotes(e.target.value)}
              className="w-full min-h-[100px] rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-otwGold focus:border-otwGold"
              placeholder="Any special instructions"
            />
          </div>
          <OtwButton onClick={handleSubmit} variant="gold" size="lg" className="w-full">Submit Request</OtwButton>
        </OtwCard>

        <OtwCard>
          <h2 className="text-lg font-semibold mb-3">Estimates</h2>
          <div className="flex flex-wrap gap-2">
            <OtwStatPill label="Estimated Miles" value={estimates.miles ? estimates.miles.toFixed(1) : '—'} />
            <OtwStatPill label="Estimated Cost" value={estimates.cost ? `$${estimates.cost.toFixed(2)}` : '—'} tone="gold" />
            <OtwStatPill label="NIP Coins" value={estimates.nip || '—'} tone="success" />
          </div>
        </OtwCard>
      </div>
    </OtwPageShell>
  );
}
