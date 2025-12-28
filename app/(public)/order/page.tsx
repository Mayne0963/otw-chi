"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { AddressSearch } from "@/components/ui/address-search";
import { ArrowRight, Loader2, MapPin, Package } from "lucide-react";
import { formatAddressLines, type GeocodedAddress } from "@/lib/geocoding";

const SERVICE_LABELS: Record<string, string> = {
  FOOD: "Food Pickup",
  STORE: "Grocery / Store",
  FRAGILE: "Fragile / Important",
  CONCIERGE: "Custom Concierge",
};

export default function OrderPage() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "review">("form");

  const [pickupAddress, setPickupAddress] = useState<GeocodedAddress | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState<GeocodedAddress | null>(null);
  const [serviceType, setServiceType] = useState("FOOD");
  const [notes, setNotes] = useState("");

  const pickupLines = pickupAddress ? formatAddressLines(pickupAddress) : null;
  const dropoffLines = dropoffAddress ? formatAddressLines(dropoffAddress) : null;

  function goToReview() {
    if (!pickupAddress || !dropoffAddress) {
      toast({
        title: "Missing Information",
        description: "Please select both pickup and dropoff addresses from the search results.",
        variant: "destructive",
      });
      return;
    }
    setStep("review");
  }

  async function handleSubmit() {
    if (!pickupAddress || !dropoffAddress) return;
    if (!isSignedIn) {
      const returnUrl = encodeURIComponent("/order");
      router.push(`/sign-in?redirect_url=${returnUrl}`);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType,
          pickupAddress: pickupAddress.formattedAddress,
          dropoffAddress: dropoffAddress.formattedAddress,
          notes: notes.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error || "Failed to submit order");
      }

      const data = await response.json();
      router.push(`/order/${data.id}`);
    } catch (_error) {
      toast({
        title: "Submission Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="otw-container otw-section min-h-[80vh] flex flex-col items-center justify-center">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-otwOffWhite">
            Request a <span className="text-otwGold">Delivery</span>
          </h1>
          <p className="text-white/60">Tell us what you need - we will handle the rest.</p>
        </div>

        <div className="otw-card p-6 sm:p-8 space-y-6 shadow-2xl shadow-black/50">
          {step === "form" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-otwGold/90 ml-1">Pickup Address</label>
                <AddressSearch
                  placeholder="Search for pickup address..."
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
                  <div className="flex items-start gap-2 text-xs text-green-600 bg-green-950/30 border border-green-900/50 rounded-lg p-2">
                    <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium">{pickupLines?.primary}</div>
                      {pickupLines?.secondary && (
                        <div className="text-green-600/80">{pickupLines.secondary}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-otwGold/90 ml-1">Dropoff Address</label>
                <AddressSearch
                  placeholder="Search for dropoff address..."
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
                  <div className="flex items-start gap-2 text-xs text-green-600 bg-green-950/30 border border-green-900/50 rounded-lg p-2">
                    <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium">{dropoffLines?.primary}</div>
                      {dropoffLines?.secondary && (
                        <div className="text-green-600/80">{dropoffLines.secondary}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-otwGold/90 ml-1">Service Type</label>
                <div className="relative">
                  <Package className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                  <select
                    name="serviceType"
                    className="flex h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 pl-9 text-sm text-otwOffWhite ring-offset-otwBlack focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-otwGold focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none"
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                  >
                    <option value="FOOD">Food Pickup</option>
                    <option value="STORE">Grocery / Store</option>
                    <option value="FRAGILE">Fragile / Important</option>
                    <option value="CONCIERGE">Custom Concierge</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-otwGold/90 ml-1">Notes (Optional)</label>
                <Textarea
                  name="notes"
                  placeholder="Gate code, special instructions, order details..."
                  className="bg-black/20 border-white/10 focus:border-otwGold/50 min-h-[80px]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="pt-2">
                <Button
                  onClick={goToReview}
                  className="w-full bg-otwGold text-otwBlack hover:bg-otwGold/90 font-bold h-12 text-base shadow-otwGlow"
                  disabled={loading || !pickupAddress || !dropoffAddress}
                >
                  Review Order <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm text-white/50">Service Type</div>
                <div className="text-lg font-semibold text-otwOffWhite">{SERVICE_LABELS[serviceType] || serviceType}</div>
              </div>
              <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
                <div>
                  <div className="text-xs text-white/50">Pickup</div>
                  <div className="text-sm font-medium">{pickupLines?.primary}</div>
                  {pickupLines?.secondary && <div className="text-xs text-white/50">{pickupLines.secondary}</div>}
                </div>
                <div>
                  <div className="text-xs text-white/50">Dropoff</div>
                  <div className="text-sm font-medium">{dropoffLines?.primary}</div>
                  {dropoffLines?.secondary && <div className="text-xs text-white/50">{dropoffLines.secondary}</div>}
                </div>
                {notes.trim() && (
                  <div>
                    <div className="text-xs text-white/50">Notes</div>
                    <div className="text-sm text-white/80">{notes}</div>
                  </div>
                )}
              </div>
              <div className="space-y-3 pt-2">
                <Button
                  onClick={handleSubmit}
                  className="w-full bg-otwGold text-otwBlack hover:bg-otwGold/90 font-bold h-12 text-base shadow-otwGlow"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Place Order"}
                </Button>
                <Button
                  onClick={() => setStep("form")}
                  variant="ghost"
                  className="w-full text-white/50 hover:text-white"
                  disabled={loading}
                >
                  Edit Details
                </Button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-white/30">
          By proceeding, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
