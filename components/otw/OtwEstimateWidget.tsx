'use client';

import { useState } from 'react';
import OtwButton from '@/components/ui/otw/OtwButton';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwStatPill from '@/components/ui/otw/OtwStatPill';

export default function OtwEstimateWidget() {
  const [result, setResult] = useState<{
    basePrice: number;
    discountedPrice: number;
    discount: number;
    nipMultiplier: number;
    waiveServiceFee: boolean;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      const response = await fetch('/api/otw/estimate', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const data = await response.json();
        setResult(data);
      } else {
        setResult(null);
      }
    } catch (error) {
      console.error('Estimate failed:', error);
      setResult(null);
    }
  };

  return (
    <OtwCard>
      <div className="text-sm font-medium">Estimate Cost</div>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <input name="pickup" className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Pickup" required />
        <input name="dropoff" className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Dropoff" required />
        <select name="serviceType" className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" defaultValue="FOOD">
          <option value="FOOD">Food</option>
          <option value="STORE">Store</option>
          <option value="FRAGILE">Fragile</option>
          <option value="CONCIERGE">Concierge</option>
        </select>
        <input name="miles" type="number" className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Miles" defaultValue="1" min="0.1" step="0.1" required />
        <OtwButton variant="gold" className="w-full">Estimate</OtwButton>
      </form>
      
      {result && (
        <div className="mt-4 space-y-2 text-sm opacity-90">
          <div className="flex justify-between">
            <span>Base Price:</span>
            <span>${result.basePrice.toFixed(2)}</span>
          </div>
          {result.discount > 0 && (
            <div className="flex justify-between text-otwGold">
              <span>Membership Discount:</span>
              <span>-{Math.round(result.discount * 100)}%</span>
            </div>
          )}
          <div className="flex justify-between font-bold">
            <span>Final Price:</span>
            <span>${result.discountedPrice.toFixed(2)}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {result.nipMultiplier > 1 && (
              <OtwStatPill label="TIREM" value={`${result.nipMultiplier}x`} tone="success" />
            )}
            {result.waiveServiceFee && (
              <OtwStatPill label="Service Fee" value="Waived" tone="gold" />
            )}
          </div>
        </div>
      )}
    </OtwCard>
  );
}
