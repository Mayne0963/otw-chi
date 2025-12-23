"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, MapPin, Package, Clock, DollarSign, ArrowRight } from "lucide-react";

export default function OrderPage() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "estimate">("form");

  const [formData, setFormData] = useState({
    pickup: "",
    dropoff: "",
    serviceType: "FOOD",
    notes: "",
  });

  const [estimate, setEstimate] = useState<{ priceMin: number; priceMax: number; eta: string; miles: number } | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  async function getEstimate() {
    if (!formData.pickup || !formData.dropoff) {
      toast({
        title: "Missing Information",
        description: "Please enter both pickup and dropoff addresses.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    // Lightweight heuristic for miles until maps are integrated
    const miles = Math.max(
      1,
      Math.round(((formData.pickup + formData.dropoff + (formData.notes || "")).length / 32) * 10)
    );

    try {
      const fd = new FormData();
      fd.set("pickup", formData.pickup);
      fd.set("dropoff", formData.dropoff);
      fd.set("serviceType", formData.serviceType);
      fd.set("miles", String(miles));

      const res = await fetch("/api/otw/estimate", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to get estimate");
      }
      const data = await res.json();
      const base = Number(data?.discountedPrice ?? data?.basePrice ?? 1500);

      // Price range: ±10% for clarity; clamp to sensible cents
      const priceMin = Math.max(0, Math.round(base * 0.9));
      const priceMax = Math.max(priceMin, Math.round(base * 1.15));

      // ETA window based on simple conversion from miles
      const minMinutes = miles * 3 + 12;
      const maxMinutes = miles * 3 + 28;
      const eta = `${minMinutes}-${maxMinutes} min`;

      setEstimate({ priceMin, priceMax, eta, miles });
      setStep("estimate");
    } catch (_error) {
      toast({
        title: "Estimate Unavailable",
        description: "Please check your details and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!isSignedIn) {
      const returnUrl = encodeURIComponent("/order");
      router.push(`/sign-in?redirect_url=${returnUrl}`);
      return;
    }
    if (!estimate) {
      await getEstimate();
      if (!estimate) return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup: formData.pickup,
          dropoff: formData.dropoff,
          serviceType: formData.serviceType,
          notes: formData.notes || undefined,
          costEstimate: Math.round(estimate.priceMax), // optimistic cap
          milesEstimate: estimate.miles,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error || "Failed to submit request");
      }

      const data = await response.json();

      router.push(`/requests/${data.id}`);
    } catch (_error) {
      toast({
        title: "Submission Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
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
          <p className="text-white/60">Tell us what you need — we’ll handle the rest.</p>
        </div>

        <div className="otw-card p-6 sm:p-8 space-y-6 shadow-2xl shadow-black/50">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-otwGold/90 ml-1">Pickup Address</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                <Input
                  name="pickup"
                  placeholder="e.g. 123 Main St, Restaurant Name"
                  className="pl-9 bg-black/20 border-white/10 focus:border-otwGold/50"
                  value={formData.pickup}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-otwGold/90 ml-1">Dropoff Address</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                <Input
                  name="dropoff"
                  placeholder="e.g. 456 Home Ave, Apt 4B"
                  className="pl-9 bg-black/20 border-white/10 focus:border-otwGold/50"
                  value={formData.dropoff}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-otwGold/90 ml-1">Service Type</label>
              <div className="relative">
                <Package className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                <select
                  name="serviceType"
                  className="flex h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 pl-9 text-sm text-otwOffWhite ring-offset-otwBlack focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-otwGold focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none"
                  value={formData.serviceType}
                  onChange={handleInputChange}
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
                value={formData.notes}
                onChange={handleInputChange}
              />
            </div>
          </div>

          {estimate && step === "estimate" && (
            <div className="bg-otwGold/10 border border-otwGold/20 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-otwGold">
                  <DollarSign className="h-5 w-5" />
                  <span className="font-bold text-lg">
                    {(estimate.priceMin / 100).toFixed(2)}–{(estimate.priceMax / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-otwOffWhite/80">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">{estimate.eta}</span>
                </div>
              </div>
              <p className="text-xs text-white/40 text-center mt-2">
                Estimated price range and time window. Final price may vary with traffic and wait times.
              </p>
            </div>
          )}

          <div className="pt-2">
            {step === "form" ? (
              <Button
                onClick={getEstimate}
                className="w-full bg-otwGold text-otwBlack hover:bg-otwGold/90 font-bold h-12 text-base shadow-otwGlow"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Get it OTW →"}
              </Button>
            ) : (
              <div className="space-y-3">
                <Button
                  onClick={handleSubmit}
                  className="w-full bg-otwGold text-otwBlack hover:bg-otwGold/90 font-bold h-12 text-base shadow-otwGlow"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <span className="flex items-center gap-2">
                      Confirm & Dispatch <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
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
            )}
          </div>
        </div>

        <p className="text-center text-xs text-white/30">
          By proceeding, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
