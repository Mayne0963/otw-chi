'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { AddressSearch } from '@/components/ui/address-search';
import { Package, Clock, DollarSign, ArrowRight, MapPin } from 'lucide-react';
import { formatAddressLines, type GeocodedAddress } from '@/lib/geocoding';

export default function RequestPage() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'estimate'>('form');
  
  const [pickupAddress, setPickupAddress] = useState<GeocodedAddress | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState<GeocodedAddress | null>(null);
  const [serviceType, setServiceType] = useState('FOOD');
  const [notes, setNotes] = useState('');

  const [estimate, setEstimate] = useState<{ priceMin: number; priceMax: number; eta: string; miles: number } | null>(null);
  const pickupLines = pickupAddress ? formatAddressLines(pickupAddress) : null;
  const dropoffLines = dropoffAddress ? formatAddressLines(dropoffAddress) : null;

  // Calculate distance between two coordinates using Haversine formula
  function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 3959; // Earth's radius in miles
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  const getEstimate = async () => {
    if (!pickupAddress || !dropoffAddress) {
      toast({
        title: "Missing Information",
        description: "Please select both pickup and dropoff addresses from the search results.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    // Calculate actual distance between pickup and dropoff
    const miles = Math.round(
      calculateDistance(
        pickupAddress.latitude,
        pickupAddress.longitude,
        dropoffAddress.latitude,
        dropoffAddress.longitude
      ) * 10
    ) / 10;

    try {
      const fd = new FormData();
      fd.set("pickup", pickupAddress.formattedAddress);
      fd.set("dropoff", dropoffAddress.formattedAddress);
      fd.set("serviceType", serviceType);
      fd.set("miles", String(miles));

      const res = await fetch("/api/otw/estimate", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to get estimate");
      }
      const data = await res.json();
      const base = Number(data?.discountedPrice ?? data?.basePrice ?? 1500);

      // Price range: ±10% for clarity
      const priceMin = Math.max(0, Math.round(base * 0.9));
      const priceMax = Math.max(priceMin, Math.round(base * 1.15));

      // ETA window based on miles
      const minMinutes = Math.round(miles * 3 + 12);
      const maxMinutes = Math.round(miles * 3 + 28);
      const eta = `${minMinutes}-${maxMinutes} min`;

      setEstimate({ priceMin, priceMax, eta, miles });
      setStep('estimate');
    } catch (error) {
      toast({
        title: "Estimate Unavailable",
        description: "Please check your details and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!isSignedIn) {
      // Redirect to sign in with return url
      const returnUrl = encodeURIComponent('/request');
      router.push(`/sign-in?redirect_url=${returnUrl}`);
      return;
    }

    if (!estimate || !pickupAddress || !dropoffAddress) {
      await getEstimate();
      if (!estimate) return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickup: pickupAddress!.formattedAddress,
          dropoff: dropoffAddress!.formattedAddress,
          serviceType: serviceType,
          notes: notes || undefined,
          costEstimate: Math.round(estimate.priceMax),
          milesEstimate: estimate.miles,
          // Store geocoded coordinates for future use
          pickupLat: pickupAddress!.latitude,
          pickupLng: pickupAddress!.longitude,
          dropoffLat: dropoffAddress!.latitude,
          dropoffLng: dropoffAddress!.longitude,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit request');
      }

      const data = await response.json();
      
      toast({
        title: "Request Submitted!",
        description: "A driver will be assigned shortly.",
      });

      router.push(`/requests/${data.id}`);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  return (
    <div className="otw-container otw-section min-h-[75vh] flex flex-col items-center justify-center">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center space-y-3">
          <span className="otw-pill">Concierge Request</span>
          <h1 className="text-4xl font-semibold tracking-tight">
            Request a <span className="text-secondary">Delivery</span>
          </h1>
          <p className="text-muted-foreground">
            Premium concierge service at your fingertips.
          </p>
        </div>

        <div className="otw-card space-y-6 p-6 sm:p-8">
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground ml-1">Pickup Location</label>
              <AddressSearch
                ariaLabel="Pickup address"
                enableCurrentLocation
                onSelect={(address) => {
                  setPickupAddress(address);
                  const lines = formatAddressLines(address);
                  toast({
                    title: "Pickup Address Set",
                    description: lines.secondary ? `${lines.primary}, ${lines.secondary}` : lines.primary,
                  });
                }}
                className="w-full"
              />
              {pickupAddress && (
                <div className="flex items-start gap-2 rounded-lg border border-secondary/40 bg-secondary/10 p-2 text-xs text-secondary">
                  <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">{pickupLines?.primary}</div>
                    {pickupLines?.secondary && (
                      <div className="text-secondary/80">{pickupLines.secondary}</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground ml-1">Dropoff Destination</label>
              <AddressSearch
                ariaLabel="Dropoff address"
                enableCurrentLocation
                onSelect={(address) => {
                  setDropoffAddress(address);
                  const lines = formatAddressLines(address);
                  toast({
                    title: "Dropoff Address Set",
                    description: lines.secondary ? `${lines.primary}, ${lines.secondary}` : lines.primary,
                  });
                }}
                className="w-full"
              />
              {dropoffAddress && (
                <div className="flex items-start gap-2 rounded-lg border border-secondary/40 bg-secondary/10 p-2 text-xs text-secondary">
                  <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">{dropoffLines?.primary}</div>
                    {dropoffLines?.secondary && (
                      <div className="text-secondary/80">{dropoffLines.secondary}</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground ml-1">Service Type</label>
                <div className="relative">
                  <Package className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <select
                    name="serviceType"
                    className="flex h-11 w-full appearance-none rounded-lg border border-border/70 bg-input px-3 py-2 pl-9 text-sm text-foreground shadow-sm transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 hover:border-secondary/60"
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                  >
                    <option value="FOOD">Food Pickup</option>
                    <option value="STORE">Store / Grocery</option>
                    <option value="FRAGILE">Fragile / Secure</option>
                    <option value="CONCIERGE">Custom Concierge</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground ml-1">Notes (Optional)</label>
              <Textarea
                name="notes"
                className="min-h-[110px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {estimate && step === 'estimate' && (
            <div className="rounded-xl border border-border/70 bg-muted/40 p-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-secondary">
                  <DollarSign className="h-5 w-5" />
                  <span className="font-bold text-lg">
                    ${(estimate.priceMin / 100).toFixed(2)}–${(estimate.priceMax / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">{estimate.eta}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Distance: {estimate.miles} miles • Estimated price range and time window
              </p>
            </div>
          )}

          <div className="pt-2">
            {step === 'form' ? (
              <Button 
                onClick={getEstimate} 
                className="w-full"
                disabled={loading || !pickupAddress || !dropoffAddress}
                isLoading={loading}
              >
                Get Estimate
              </Button>
            ) : (
              <div className="space-y-3">
                <Button 
                  onClick={handleSubmit} 
                  className="w-full"
                  disabled={loading}
                  isLoading={loading}
                >
                  {!loading && (
                    <span className="flex items-center gap-2">
                      {isSignedIn ? 'Confirm & Request' : 'Sign In to Request'}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
                <Button 
                  onClick={() => setStep('form')} 
                  variant="ghost" 
                  className="w-full text-muted-foreground hover:text-foreground"
                  disabled={loading}
                >
                  Edit Details
                </Button>
              </div>
            )}
          </div>

        </div>
        
        <p className="text-center text-xs text-muted-foreground">
          By proceeding, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
