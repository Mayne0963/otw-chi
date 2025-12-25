'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import OtwCard from '@/components/ui/otw/OtwCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';

const SERVICE_TYPES = [
  { id: 'FOOD', label: 'Food Delivery', desc: 'Restaurants & Takeout' },
  { id: 'STORE', label: 'Store Pickup', desc: 'Groceries & Retail' },
  { id: 'FRAGILE', label: 'Fragile Item', desc: 'Careful handling required' },
  { id: 'CONCIERGE', label: 'Concierge', desc: 'Custom errands' },
];

export default function OrderForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState<{ basePrice: number, miles: number } | null>(null);
  
  const [formData, setFormData] = useState({
    pickup: '',
    dropoff: '',
    serviceType: 'FOOD',
    notes: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleServiceChange = (value: string) => {
    setFormData(prev => ({ ...prev, serviceType: value }));
  };

  const getEstimate = async () => {
    setLoading(true);
    try {
      // Mock distance calculation for MVP: random miles between 1-10 if not real
      const miles = Math.floor(Math.random() * 9) + 1;
      
      const form = new FormData();
      form.append('miles', miles.toString());
      
      const res = await fetch('/api/otw/estimate', {
        method: 'POST',
        body: form,
      });
      
      const data = await res.json();
      setEstimate(data);
      setStep(2);
    } catch (error) {
      console.error(error);
      alert('Failed to get estimate');
    } finally {
      setLoading(false);
    }
  };

  const submitOrder = async () => {
    if (!estimate) return;
    setLoading(true);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          costEstimate: estimate.basePrice,
          milesEstimate: estimate.miles,
        }),
      });

      if (!res.ok) throw new Error('Failed to create order');
      
      const data = await res.json();
      router.push(`/requests/${data.id}`);
    } catch (error) {
      console.error(error);
      alert('Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  if (step === 1) {
    return (
      <OtwCard className="max-w-xl mx-auto">
        <div className="space-y-6">
            <div className="space-y-4">
                <div>
                    <Label className="text-otwOffWhite">Pickup Address</Label>
                    <Input 
                        name="pickup" 
                        value={formData.pickup} 
                        onChange={handleChange} 
                        placeholder="e.g. 123 Main St"
                        className="bg-white/5 border-white/10 text-white"
                    />
                </div>
                <div>
                    <Label className="text-otwOffWhite">Dropoff Address</Label>
                    <Input 
                        name="dropoff" 
                        value={formData.dropoff} 
                        onChange={handleChange} 
                        placeholder="e.g. 456 Elm St"
                        className="bg-white/5 border-white/10 text-white"
                    />
                </div>
            </div>

            <div>
                <Label className="text-otwOffWhite mb-3 block">Service Type</Label>
                <RadioGroup value={formData.serviceType} onValueChange={handleServiceChange} className="grid grid-cols-2 gap-4">
                    {SERVICE_TYPES.map(type => (
                        <div key={type.id}>
                            <RadioGroupItem value={type.id} id={type.id} className="peer sr-only" />
                            <Label 
                                htmlFor={type.id}
                                className="flex flex-col items-center justify-between rounded-md border-2 border-white/10 bg-white/5 p-4 hover:bg-white/10 hover:text-white peer-data-[state=checked]:border-otwGold peer-data-[state=checked]:text-otwGold cursor-pointer transition-all"
                            >
                                <span className="font-semibold">{type.label}</span>
                                <span className="text-xs text-white/50 mt-1">{type.desc}</span>
                            </Label>
                        </div>
                    ))}
                </RadioGroup>
            </div>

            <div>
                <Label className="text-otwOffWhite">Notes (Optional)</Label>
                <Textarea 
                    name="notes" 
                    value={formData.notes} 
                    onChange={handleChange} 
                    placeholder="Gate code, special instructions..."
                    className="bg-white/5 border-white/10 text-white"
                />
            </div>

            <Button 
                onClick={getEstimate} 
                disabled={!formData.pickup || !formData.dropoff || loading}
                className="w-full bg-otwGold text-otwBlack hover:bg-otwGold/90 font-bold"
            >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Next: Review & Pay
            </Button>
        </div>
      </OtwCard>
    );
  }

  return (
    <OtwCard className="max-w-xl mx-auto">
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-otwOffWhite mb-4">Review Order</h2>
            
            <div className="space-y-4 bg-white/5 p-4 rounded-lg">
                <div className="flex justify-between text-sm">
                    <span className="text-white/60">Pickup</span>
                    <span className="text-white text-right">{formData.pickup}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-white/60">Dropoff</span>
                    <span className="text-white text-right">{formData.dropoff}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-white/60">Service</span>
                    <span className="text-otwGold">{SERVICE_TYPES.find(t => t.id === formData.serviceType)?.label}</span>
                </div>
                <div className="pt-4 border-t border-white/10 flex justify-between items-end">
                    <span className="text-white/60">Estimated Total</span>
                    <div className="text-right">
                        <span className="text-2xl font-bold text-green-400">${((estimate?.basePrice || 0) / 100).toFixed(2)}</span>
                        <p className="text-xs text-white/40">{estimate?.miles} miles est.</p>
                    </div>
                </div>
            </div>

            <div className="flex gap-4">
                <Button 
                    variant="outline" 
                    onClick={() => setStep(1)}
                    className="flex-1 border-white/20 text-white hover:bg-white/10"
                >
                    Back
                </Button>
                <Button 
                    onClick={submitOrder} 
                    disabled={loading}
                    className="flex-1 bg-green-600 text-white hover:bg-green-700 font-bold"
                >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Place Order
                </Button>
            </div>
        </div>
    </OtwCard>
  );
}
