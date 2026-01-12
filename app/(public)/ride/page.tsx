"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { AddressSearch } from "@/components/ui/address-search";
import { MapPin, Car, Loader2 } from "lucide-react";
import { formatAddressLines, type GeocodedAddress, validateAddress } from "@/lib/geocoding";
import OtwPageShell from "@/components/ui/otw/OtwPageShell";
import OtwCard from "@/components/ui/otw/OtwCard";
import OtwButton from "@/components/ui/otw/OtwButton";
import OtwStatPill from "@/components/ui/otw/OtwStatPill";
import { useToast } from "@/components/ui/use-toast";

const formatCurrency = (value: number | null | undefined) =>
  typeof value === "number" ? `$${(value / 100).toFixed(2)}` : "—";

const SESSION_RIDE_DRAFT_KEY = "otw-ride-draft-cache-v1";

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
  const { isSignedIn } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [pickupAddress, setPickupAddress] = useState<GeocodedAddress | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState<GeocodedAddress | null>(null);
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
        const fee = Number(data?.discountedPrice ?? data?.basePrice);
        
        if (!Number.isFinite(fee) || fee <= 0) {
          throw new Error("Invalid pricing response.");
        }
        
        if (!cancelled) {
          setRideFeeCents(Math.round(fee));
        }
      } catch (error) {
        if (!cancelled) {
          setEstimateError(
            error instanceof Error ? error.message : "Unable to calculate fare."
          );
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
  }, [pickupAddress, dropoffAddress]);

  // Persist Draft
  function buildDraftPayload() {
    if (!pickupAddress || !dropoffAddress) return null;

    return {
      draftId: draftId || undefined,
      serviceType: "RIDE",
      pickupAddress: pickupAddress.formattedAddress,
      dropoffAddress: dropoffAddress.formattedAddress,
      notes: notes.trim() || undefined,
      deliveryFeeCents: rideFeeCents > 0 ? rideFeeCents : undefined,
    };
  }

  async function persistDraft() {
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
  }

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
  }, [draftLoaded, isSignedIn, pickupAddress, dropoffAddress, notes, rideFeeCents]);

  const handleRequestRide = async () => {
    if (!isSignedIn) {
      router.push("/sign-in?redirect_url=/ride");
      return;
    }

    if (!pickupAddress || !dropoffAddress) {
      toast({
        title: "Missing details",
        description: "Please select pickup and dropoff locations.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    // Proceed to checkout or final submission
    // For now, we'll use the same flow as orders which might require payment
    // We can reuse the checkout logic or simple submission
    
    // Creating the Checkout Session
    try {
       const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId,
          serviceType: "RIDE",
          amountCents: rideFeeCents,
          redirectUrl: "/ride", // Return here after payment
        }),
      });

      if (res.ok) {
        const { url } = await res.json();
        if (url) {
            window.location.href = url;
            return;
        }
      }
      
      // If free or error, handle accordingly
      toast({
        title: "Error",
        description: "Could not initiate payment.",
        variant: "destructive",
      });

    } catch (error) {
        console.error(error);
        toast({
            title: "Error",
            description: "Something went wrong.",
            variant: "destructive",
        });
    } finally {
        setLoading(false);
    }
  };

  const pickupLines = pickupAddress ? formatAddressLines(pickupAddress) : null;
  const dropoffLines = dropoffAddress ? formatAddressLines(dropoffAddress) : null;

  return (
    <OtwPageShell>
      <div className="mx-auto max-w-lg space-y-6">
        <div className="text-center space-y-3">
          <OtwStatPill tone="info">Ride Service</OtwStatPill>
          <h1 className="text-4xl font-semibold tracking-tight">
            Request a <span className="text-secondary">Ride</span>
          </h1>
          <p className="text-muted-foreground">
            Get where you need to go with OnTheWay.
          </p>
        </div>

        <OtwCard className="p-6 space-y-6">
          {/* Pickup */}
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

          {/* Dropoff */}
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

          {/* Estimate */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Car className="h-5 w-5 text-secondary" />
                <span className="font-medium">Estimated Fare</span>
              </div>
              <div className="text-right">
                {estimateLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : estimateError ? (
                  <span className="text-sm text-destructive">Unavailable</span>
                ) : (
                  <span className="text-xl font-bold">{formatCurrency(rideFeeCents)}</span>
                )}
              </div>
            </div>
            {estimateError && (
              <p className="mt-2 text-xs text-destructive">{estimateError}</p>
            )}
          </div>

          {/* Action */}
          <OtwButton
            onClick={handleRequestRide}
            disabled={!pickupAddress || !dropoffAddress || estimateLoading || loading || rideFeeCents <= 0}
            className="w-full h-12 text-lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              "Request Ride"
            )}
          </OtwButton>
        </OtwCard>
      </div>
    </OtwPageShell>
  );
}
