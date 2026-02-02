"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/neon-auth";
import { AddressSearch } from "@/components/ui/address-search";
import { MapPin, Car, Loader2, Users, ArrowRight, CreditCard } from "lucide-react";
import { formatAddressLines, type GeocodedAddress, validateAddress } from "@/lib/geocoding";
import OtwPageShell from "@/components/ui/otw/OtwPageShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import StripePaymentForm from "@/components/stripe/StripePaymentForm";

const formatCurrency = (value: number | null | undefined) =>
  typeof value === "number" ? `$${(value / 100).toFixed(2)}` : "—";

type Step = "locations" | "options" | "review";

type RideOption = "STANDARD" | "XL";

function calculateMiles(a: GeocodedAddress, b: GeocodedAddress): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3959; // Earth radius in miles
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return Math.max(0.1, 2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}

export default function RidePage() {
  const session = authClient.auth.useSession();
  const isSignedIn = !!session.data?.user;
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("locations");
  const [pickupAddress, setPickupAddress] = useState<GeocodedAddress | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState<GeocodedAddress | null>(null);
  const [rideOption, setRideOption] = useState<RideOption>("STANDARD");
  const [notes, setNotes] = useState("");

  const [rideFeeCents, setRideFeeCents] = useState(0);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const draftSaveTimeout = useRef<number | null>(null);

  // Load Draft
  useEffect(() => {
    if (!isSignedIn) return;
    if (draftLoaded) return;

    let cancelled = false;

    async function loadDraft() {
      try {
        const response = await fetch("/api/orders/draft");
        if (!response.ok) {
          setDraftLoaded(true);
          return;
        }
        const data = await response.json();
        const draft = data?.draft;
        
        // Only load if it's a RIDE draft
        if (!draft || draft.serviceType !== "RIDE") {
          setDraftLoaded(true);
          return;
        }

        setDraftId(draft.id);
        setNotes(draft.notes || "");
        if (typeof draft.deliveryFeeCents === "number") {
          setRideFeeCents(draft.deliveryFeeCents);
        }

        if (draft.pickupAddress) {
          const restoredPickup = await validateAddress(draft.pickupAddress);
          if (!cancelled && restoredPickup) setPickupAddress(restoredPickup);
        }
        if (draft.dropoffAddress) {
          const restoredDropoff = await validateAddress(draft.dropoffAddress);
          if (!cancelled && restoredDropoff) setDropoffAddress(restoredDropoff);
        }
      } catch (error) {
        console.warn("Draft load failed:", error);
      } finally {
        if (!cancelled) {
          setDraftLoaded(true);
        }
      }
    }

    loadDraft();

    return () => {
      cancelled = true;
    };
  }, [draftLoaded, isSignedIn]);

  // Calculate Estimate
  useEffect(() => {
    if (!pickupAddress || !dropoffAddress) {
      setRideFeeCents(0);
      setEstimateError(null);
      setEstimateLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const estimate = async () => {
      setEstimateLoading(true);
      setEstimateError(null);

      const origin = `${pickupAddress.latitude},${pickupAddress.longitude}`;
      const destination = `${dropoffAddress.latitude},${dropoffAddress.longitude}`;

      let miles = calculateMiles(pickupAddress, dropoffAddress);
      
      // Try to get real route distance
      try {
        const routeRes = await fetch(
          `/api/navigation/route?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`,
          { signal: controller.signal }
        );
        if (routeRes.ok) {
          const routeData = await routeRes.json();
          const lengthMeters = routeData?.route?.summary?.length;
          if (typeof lengthMeters === "number" && Number.isFinite(lengthMeters)) {
            miles = Math.max(0.1, lengthMeters / 1609.34);
          }
        }
      } catch (_error) {
        // Fallback to straight line distance
      }

      try {
        const fd = new FormData();
        fd.set("miles", String(miles));
        fd.set("serviceType", "RIDE");
        // Adjust multiplier for XL if needed
        const multiplier = rideOption === "XL" ? 1.5 : 1.0;
        
        const estimateRes = await fetch("/api/otw/estimate", {
          method: "POST",
          body: fd,
          signal: controller.signal,
        });
        
        if (!estimateRes.ok) {
          const error = await estimateRes.json().catch(() => ({}));
          throw new Error(error?.error || "Unable to calculate fare.");
        }
        
        const data = await estimateRes.json();
        let fee = Number(data?.discountedPrice ?? data?.basePrice);
        
        if (!Number.isFinite(fee) || fee <= 0) {
          throw new Error("Invalid pricing response.");
        }

        fee = fee * multiplier;
        
        if (!cancelled) {
          setRideFeeCents(Math.round(fee));
          setEstimateError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setRideFeeCents(0);
          setEstimateError(error instanceof Error ? error.message : "Unable to calculate fare.");
        }
      } finally {
        if (!cancelled) {
          setEstimateLoading(false);
        }
      }
    };

    estimate();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [pickupAddress, dropoffAddress, rideOption]);

  // Persist Draft
  const buildDraftPayload = useCallback(() => {
    if (!pickupAddress || !dropoffAddress) return null;

    return {
      draftId: draftId || undefined,
      serviceType: "RIDE",
      pickupAddress: pickupAddress.formattedAddress,
      dropoffAddress: dropoffAddress.formattedAddress,
      notes: `${rideOption} Ride. ${notes}`.trim(),
      deliveryFeeCents: rideFeeCents > 0 ? rideFeeCents : undefined,
    };
  }, [draftId, dropoffAddress, notes, pickupAddress, rideFeeCents, rideOption]);

  const persistDraft = useCallback(async () => {
    if (!isSignedIn) return;
    const draftPayload = buildDraftPayload();
    if (!draftPayload) return;

    const response = await fetch("/api/orders/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draftPayload),
    });
    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      if (data?.draftId) {
        setDraftId(data.draftId);
      }
    }
  }, [buildDraftPayload, isSignedIn]);

  useEffect(() => {
    if (!draftLoaded || !isSignedIn) return;

    if (draftSaveTimeout.current) {
      window.clearTimeout(draftSaveTimeout.current);
    }

    draftSaveTimeout.current = window.setTimeout(() => {
      persistDraft().catch(() => null);
    }, 700);

    return () => {
      if (draftSaveTimeout.current) {
        window.clearTimeout(draftSaveTimeout.current);
      }
    };
  }, [draftLoaded, isSignedIn, persistDraft]);

  const handleStripePaymentSuccess = useCallback((_paymentIntentId: string) => {
    toast({
      title: "Payment authorized",
      description: "Your ride request has been confirmed.",
    });

    router.push("/requests");
  }, [router, toast]);

  const handleStripePaymentError = useCallback((error: string) => {
    toast({
      title: "Payment failed",
      description: error || "Unable to authorize payment.",
      variant: "destructive",
    });
  }, [toast]);

  const pickupLines = pickupAddress ? formatAddressLines(pickupAddress) : null;
  const dropoffLines = dropoffAddress ? formatAddressLines(dropoffAddress) : null;

  const canProceedToOptions = !!pickupAddress && !!dropoffAddress;

  return (
    <OtwPageShell>
      <div className="mx-auto max-w-lg space-y-6">
        <div className="text-center space-y-3">
          <Badge variant="secondary">Ride Service</Badge>
          <h1 className="text-4xl font-semibold tracking-tight">
            Request a <span className="text-secondary">Ride</span>
          </h1>
          <p className="text-muted-foreground">
            Get where you need to go with OnTheWay.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span className={cn(step === "locations" && "text-foreground font-medium")}>Locations</span>
          <ArrowRight className="h-3 w-3" />
          <span className={cn(step === "options" && "text-foreground font-medium")}>Options</span>
          <ArrowRight className="h-3 w-3" />
          <span className={cn(step === "review" && "text-foreground font-medium")}>Review</span>
        </div>

        <Card className="p-6 space-y-6">
          {/* Step 1: Locations */}
          {step === "locations" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                  <MapPin className="h-4 w-4 text-green-500" />
                  Pickup Location
                </div>
                {pickupAddress ? (
                  <div className="relative rounded-lg border bg-muted/30 p-3 pr-10">
                    <div className="text-sm font-medium">{pickupLines?.primary}</div>
                    <div className="text-xs text-muted-foreground">{pickupLines?.secondary}</div>
                    <button
                      onClick={() => setPickupAddress(null)}
                      className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <AddressSearch
                    placeholder="Enter pickup address..."
                    onSelect={setPickupAddress}
                    className="w-full"
                  />
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                  <MapPin className="h-4 w-4 text-otwRed" />
                  Dropoff Location
                </div>
                {dropoffAddress ? (
                  <div className="relative rounded-lg border bg-muted/30 p-3 pr-10">
                    <div className="text-sm font-medium">{dropoffLines?.primary}</div>
                    <div className="text-xs text-muted-foreground">{dropoffLines?.secondary}</div>
                    <button
                      onClick={() => setDropoffAddress(null)}
                      className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <AddressSearch
                    placeholder="Enter destination..."
                    onSelect={setDropoffAddress}
                    className="w-full"
                  />
                )}
              </div>

              <Button
                onClick={() => setStep("options")}
                disabled={!canProceedToOptions}
                className="w-full"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Step 2: Options */}
          {step === "options" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
               <div className="grid grid-cols-1 gap-4">
                  <div 
                    onClick={() => setRideOption("STANDARD")}
                    className={cn(
                      "cursor-pointer rounded-xl border p-4 transition-all hover:bg-muted/50",
                      rideOption === "STANDARD" ? "border-secondary bg-secondary/5 ring-1 ring-secondary" : "border-border"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                          <Car className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-medium">Standard</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" /> 1-4 seats
                          </div>
                        </div>
                      </div>
                      <div className="font-semibold">
                         {/* We assume base price is standard */}
                         {estimateLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : formatCurrency(rideFeeCents / (rideOption === "XL" ? 1.5 : 1))}
                      </div>
                    </div>
                  </div>

                  <div 
                    onClick={() => setRideOption("XL")}
                    className={cn(
                      "cursor-pointer rounded-xl border p-4 transition-all hover:bg-muted/50",
                      rideOption === "XL" ? "border-secondary bg-secondary/5 ring-1 ring-secondary" : "border-border"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                          <Car className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="font-medium">Ride XL</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" /> 1-6 seats
                          </div>
                        </div>
                      </div>
                      <div className="font-semibold">
                         {estimateLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : formatCurrency((rideFeeCents / (rideOption === "XL" ? 1.5 : 1)) * 1.5)}
                      </div>
                    </div>
                  </div>
               </div>

               {estimateError ? (
                 <div className="text-sm text-red-500">{estimateError}</div>
               ) : null}

               <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep("locations")}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={() => setStep("review")}
                  disabled={estimateLoading || rideFeeCents <= 0}
                  className="flex-[2]"
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === "review" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="rounded-lg border bg-muted/50 p-4 space-y-4">
                <div className="flex justify-between items-start border-b border-border/50 pb-4">
                  <div>
                    <div className="font-medium">{rideOption === "STANDARD" ? "Standard Ride" : "Ride XL"}</div>
                    <div className="text-sm text-muted-foreground">{pickupLines?.primary} <ArrowRight className="inline h-3 w-3 mx-1" /> {dropoffLines?.primary}</div>
                  </div>
                  <div className="text-xl font-bold">{formatCurrency(rideFeeCents)}</div>
                </div>

                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <CreditCard className="h-4 w-4" />
                  <span>Pay securely with Stripe</span>
                </div>

                <StripePaymentForm
                  amountCents={rideFeeCents}
                  onSuccess={handleStripePaymentSuccess}
                  onError={handleStripePaymentError}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep("options")}
                  className="flex-1"
                >
                  Back
                </Button>
              </div>
            </div>
          )}

        </Card>
      </div>
    </OtwPageShell>
  );
}
