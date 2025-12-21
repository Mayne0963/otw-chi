'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { createRequest } from '@/app/actions/requests';
import { Package, ShoppingBag, Wine, Briefcase, MapPin, ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/cn';

// Define ServiceType locally to avoid importing @prisma/client in a client component
enum ServiceType {
  FOOD = 'FOOD',
  STORE = 'STORE',
  FRAGILE = 'FRAGILE',
  CONCIERGE = 'CONCIERGE',
}

const SERVICE_TYPES = [
  { id: ServiceType.FOOD, label: 'Food Delivery', icon: ShoppingBag, desc: 'Hot meals from restaurants' },
  { id: ServiceType.STORE, label: 'Store Pickup', icon: Package, desc: 'Groceries and retail items' },
  { id: ServiceType.FRAGILE, label: 'Fragile / White Glove', icon: Wine, desc: 'Careful handling required' },
  { id: ServiceType.CONCIERGE, label: 'Concierge', icon: Briefcase, desc: 'Custom errands and tasks' },
];

export default function NewRequestPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    serviceType: '' as any,
    pickup: '',
    dropoff: '',
    notes: '',
  });

  const handleNext = () => setStep(step + 1);
  const handleBack = () => setStep(step - 1);

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader 
        title="New Delivery Request" 
        description="Tell us what you need delivered and where." 
      />

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8 px-4">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
              step >= s ? "bg-otw-primary text-white" : "bg-otw-panel border border-otw-border text-otw-textMuted"
            )}>
              {step > s ? <Check className="w-5 h-5" /> : s}
            </div>
            {s < 3 && <div className={cn("w-16 h-1 mx-2", step > s ? "bg-otw-primary" : "bg-otw-border")} />}
          </div>
        ))}
      </div>

      <form action={createRequest} className="bg-otw-panel border border-otw-border rounded-3xl p-6 shadow-otwSoft">
        
        {/* Step 1: Service Type */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-otw-text mb-4">Select Service Type</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SERVICE_TYPES.map((type) => (
                <div 
                  key={type.id}
                  onClick={() => updateField('serviceType', type.id)}
                  className={cn(
                    "cursor-pointer p-4 rounded-2xl border transition-all hover:border-otw-primary",
                    formData.serviceType === type.id 
                      ? "bg-otw-primary/10 border-otw-primary ring-1 ring-otw-primary" 
                      : "bg-otw-bg border-otw-border"
                  )}
                >
                  <type.icon className={cn("w-8 h-8 mb-3", formData.serviceType === type.id ? "text-otw-primary" : "text-otw-textMuted")} />
                  <h3 className="font-semibold text-otw-text">{type.label}</h3>
                  <p className="text-sm text-otw-textMuted">{type.desc}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-4">
              <Button type="button" onClick={handleNext} disabled={!formData.serviceType}>
                Next <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Locations & Notes */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-otw-text mb-4">Delivery Details</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-otw-textMuted mb-1">Pickup Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-5 h-5 text-otw-textMuted" />
                  <input 
                    type="text" 
                    name="pickup"
                    required
                    className="w-full bg-otw-bg border border-otw-border rounded-xl py-2.5 pl-10 pr-4 text-otw-text focus:outline-none focus:ring-2 focus:ring-otw-primary"
                    placeholder="Enter pickup location"
                    value={formData.pickup}
                    onChange={(e) => updateField('pickup', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-otw-textMuted mb-1">Dropoff Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-5 h-5 text-otw-textMuted" />
                  <input 
                    type="text" 
                    name="dropoff"
                    required
                    className="w-full bg-otw-bg border border-otw-border rounded-xl py-2.5 pl-10 pr-4 text-otw-text focus:outline-none focus:ring-2 focus:ring-otw-primary"
                    placeholder="Enter dropoff location"
                    value={formData.dropoff}
                    onChange={(e) => updateField('dropoff', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-otw-textMuted mb-1">Notes (Optional)</label>
                <textarea 
                  name="notes"
                  rows={3}
                  className="w-full bg-otw-bg border border-otw-border rounded-xl p-3 text-otw-text focus:outline-none focus:ring-2 focus:ring-otw-primary"
                  placeholder="Gate codes, special instructions, etc."
                  value={formData.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button type="button" variant="ghost" onClick={handleBack}>Back</Button>
              <Button type="button" onClick={handleNext} disabled={!formData.pickup || !formData.dropoff}>
                Next <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-otw-text mb-4">Review & Submit</h2>
            
            <div className="bg-otw-bg rounded-2xl p-4 border border-otw-border space-y-3">
              <div className="flex justify-between">
                <span className="text-otw-textMuted">Service</span>
                <span className="font-medium text-otw-text">{formData.serviceType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-otw-textMuted">Pickup</span>
                <span className="font-medium text-otw-text text-right max-w-[60%] truncate">{formData.pickup}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-otw-textMuted">Dropoff</span>
                <span className="font-medium text-otw-text text-right max-w-[60%] truncate">{formData.dropoff}</span>
              </div>
              <div className="border-t border-otw-border pt-2 flex justify-between items-center">
                <span className="text-otw-textMuted">Estimated Cost</span>
                <div className="text-right">
                  <span className="block font-bold text-otw-accent text-lg">Estimate Pending</span>
                  <span className="text-xs text-otw-textMuted">Base $7.99 + $1.99/mile</span>
                </div>
              </div>
            </div>

            {/* Hidden inputs for server action */}
            <input type="hidden" name="serviceType" value={formData.serviceType} />
            <input type="hidden" name="pickup" value={formData.pickup} />
            <input type="hidden" name="dropoff" value={formData.dropoff} />
            <input type="hidden" name="notes" value={formData.notes} />

            <div className="flex justify-between pt-4">
              <Button type="button" variant="ghost" onClick={handleBack}>Back</Button>
              <Button type="submit" variant="default" className="w-full ml-4">
                Confirm Request
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
