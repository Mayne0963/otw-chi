"use client";
import React, { useMemo, useState } from 'react';

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
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">What You Need Today?</h1>
        <p className="text-otwOffWhite/80">Tell OTW where to go and we’ll handle the rest.</p>
      </header>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-otwBlack border border-otwRedDark rounded-3xl p-6 space-y-4 shadow-otwSoft">
          <div className="space-y-1">
            <label className="text-sm">Pickup Location</label>
            <input value={pickup} onChange={e=>setPickup(e.target.value)} className="w-full rounded-xl bg-otwBlack border border-otwRedDark px-3 py-2" placeholder="123 Broski Ave" />
          </div>
          <div className="space-y-1">
            <label className="text-sm">Dropoff Location</label>
            <input value={dropoff} onChange={e=>setDropoff(e.target.value)} className="w-full rounded-xl bg-otwBlack border border-otwRedDark px-3 py-2" placeholder="456 Executive St" />
          </div>
          <div className="space-y-1">
            <label className="text-sm">Service Type</label>
            <select value={service} onChange={e=>setService(e.target.value)} className="w-full rounded-xl bg-otwBlack border border-otwRedDark px-3 py-2">
              <option>Food Pickup</option>
              <option>Store / Grocery</option>
              <option>Fragile Delivery</option>
              <option>Custom Concierge</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm">Notes to Driver</label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} className="w-full min-h-[100px] rounded-xl bg-otwBlack border border-otwRedDark px-3 py-2" placeholder="Any special instructions" />
          </div>
          <button onClick={handleSubmit} className="w-full bg-otwGold text-otwBlack font-semibold rounded-2xl py-3 hover:shadow-otwGlow">Submit Request</button>
        </div>

        <aside className="bg-otwBlack border border-otwRedDark rounded-3xl p-6 shadow-otwSoft">
          <h2 className="text-lg font-semibold mb-2">Estimates</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Estimated Miles</span><span>{estimates.miles ? estimates.miles.toFixed(1) : '—'}</span></div>
            <div className="flex justify-between"><span>Estimated Cost</span><span>{estimates.cost ? `$${estimates.cost.toFixed(2)}` : '—'}</span></div>
            <div className="flex justify-between"><span>NIP Coins You’ll Earn</span><span>{estimates.nip || '—'}</span></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
