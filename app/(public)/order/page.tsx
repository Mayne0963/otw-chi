"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { AddressSearch } from "@/components/ui/address-search";
import { ArrowRight, CheckCircle2, CreditCard, ExternalLink, Loader2, MapPin, Package, Upload, X } from "lucide-react";
import { formatAddressLines, type GeocodedAddress, validateAddress } from "@/lib/geocoding";
import { parseReceiptText, type ReceiptItem } from "@/lib/receipts/parse";

const SERVICE_LABELS: Record<string, string> = {
  FOOD: "Food Pickup",
  STORE: "Grocery / Store",
  FRAGILE: "Fragile / Important",
  CONCIERGE: "Custom Concierge",
};

const formatCurrency = (value: number | null | undefined) =>
  typeof value === "number" ? `$${(value / 100).toFixed(2)}` : "—";

type Step = "details" | "restaurant" | "receipt" | "review";

type ReceiptAnalysis = {
  vendorName: string;
  location: string;
  items: ReceiptItem[];
  authenticityScore: number;
  authenticityReason: string;
  imageData?: string;
};

const AUTHENTICITY_THRESHOLD = 0.85;
const MAX_OCR_BYTES = 1.2 * 1024 * 1024;
const OCR_TIMEOUT_MS = 6_000;
const SESSION_DRAFT_KEY = "otw-order-draft-cache-v1";

async function buildHash(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function inferVendorName(name?: string, filename?: string): string {
  if (name?.trim()) return name.trim();
  if (filename) {
    const base = filename.replace(/\.[^/.]+$/, "");
    if (base.length > 2) return base.replace(/[_-]+/g, " ").trim();
  }
  return "Detected Restaurant";
}

function inferLocation(pickup?: string, dropoff?: string): string {
  if (pickup?.trim()) {
    const parts = pickup.split(",").map((part) => part.trim());
    return parts.slice(0, 2).join(", ") || pickup;
  }
  if (dropoff?.trim()) {
    const parts = dropoff.split(",").map((part) => part.trim());
    return parts.slice(0, 2).join(", ") || dropoff;
  }
  return "Location not detected";
}

function generateFallbackItems(hash: string, restaurantName: string): ReceiptItem[] {
  const palette = [
    "House Special",
    "Signature Plate",
    "Chef's Pick",
    "Side Selection",
    "Beverage",
    "Dessert Bite",
  ];
  const numbers = hash.slice(0, 12).match(/.{1,2}/g) || [];
  return numbers.slice(0, 3).map((chunk, idx) => {
    const seed = parseInt(chunk, 16);
    const price = Math.max(3, (seed % 1800) / 100);
    const quantity = (seed % 2) + 1;
    const name = `${restaurantName} ${palette[idx % palette.length]}`;
    return { name, quantity, price: Number(price.toFixed(2)) };
  });
}

function computeAuthenticity(
  ocrConfidence: number,
  sizeBytes: number
): { score: number; reason: string } {
  const sizeScore = Math.min(1, sizeBytes / 120_000);
  const ocrScore = Math.min(1, Math.max(0, ocrConfidence / 100));
  const combined = Number((sizeScore * 0.4 + ocrScore * 0.6).toFixed(2));
  const reason =
    combined > 0.8
      ? "Passed realism and OCR checks"
      : combined > 0.55
        ? "Looks like a real photo but OCR confidence is moderate"
        : "Low OCR confidence; please double-check clarity";
  return { score: combined, reason };
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read receipt image"));
      }
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read receipt image"));
    reader.readAsDataURL(file);
  });
}

async function runOcr(file: File) {
  if (file.size > MAX_OCR_BYTES) {
    return { text: "", confidence: 0 };
  }

  const { recognize } = await import("tesseract.js");
  const timeoutPromise = new Promise<never>((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error("OCR timed out"));
    }, OCR_TIMEOUT_MS);
  });

  const result = await Promise.race([recognize(file, "eng"), timeoutPromise]);
  return { text: result.data.text || "", confidence: result.data.confidence || 0 };
}

export default function OrderPage() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("details");

  const [pickupAddress, setPickupAddress] = useState<GeocodedAddress | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState<GeocodedAddress | null>(null);
  const [serviceType, setServiceType] = useState("FOOD");
  const [notes, setNotes] = useState("");

  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantWebsite, setRestaurantWebsite] = useState("");

  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptImageData, setReceiptImageData] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [receiptAnalysis, setReceiptAnalysis] = useState<ReceiptAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const [deliveryFeeCents, setDeliveryFeeCents] = useState(995);
  const [feePaid, setFeePaid] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [deliveryCheckoutSessionId, setDeliveryCheckoutSessionId] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [discountCents, setDiscountCents] = useState(0);
  const [couponApplying, setCouponApplying] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const draftSaveTimeout = useRef<number | null>(null);
  const receiptObjectUrl = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cached = window.sessionStorage.getItem(SESSION_DRAFT_KEY);
    if (!cached) return;
    try {
      const parsed = JSON.parse(cached) as {
        receiptImageData?: string;
        receiptAnalysis?: ReceiptAnalysis;
      };
      if (parsed.receiptImageData && !receiptImageData) {
        setReceiptPreview(parsed.receiptImageData);
        setReceiptImageData(parsed.receiptImageData);
      }
      if (parsed.receiptAnalysis && !receiptAnalysis) {
        setReceiptAnalysis(parsed.receiptAnalysis);
      }
    } catch (error) {
      console.warn("Session draft restore failed:", error);
    }
  }, [receiptAnalysis, receiptImageData]);

  const requiresReceipt = serviceType === "FOOD";

  const pickupLines = pickupAddress ? formatAddressLines(pickupAddress) : null;
  const dropoffLines = dropoffAddress ? formatAddressLines(dropoffAddress) : null;

  useEffect(() => {
    if (pickupAddress && dropoffAddress) {
      const latDiff = Math.abs(pickupAddress.latitude - dropoffAddress.latitude);
      const lngDiff = Math.abs(pickupAddress.longitude - dropoffAddress.longitude);
      const approxMiles = Math.max(1, Math.round(Math.sqrt(latDiff ** 2 + lngDiff ** 2) * 69));
      const cents = Math.min(2999, Math.max(799, 650 + approxMiles * 55));
      setDeliveryFeeCents(cents);
    } else {
      setDeliveryFeeCents(995);
    }
  }, [pickupAddress, dropoffAddress]);

  useEffect(() => {
    if (serviceType !== "FOOD") {
      setStep("details");
      setFeePaid(false);
      setDeliveryCheckoutSessionId(null);
      setCouponCode("");
      setDiscountCents(0);
    }
  }, [serviceType]);

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
        if (!draft) {
          setDraftLoaded(true);
          return;
        }

        setDraftId(draft.id);
        setServiceType(draft.serviceType || "FOOD");
        setNotes(draft.notes || "");
        setRestaurantName(draft.restaurantName || "");
        setRestaurantWebsite(draft.restaurantWebsite || "");
        if (typeof draft.deliveryFeeCents === "number") {
          setDeliveryFeeCents(draft.deliveryFeeCents);
        }
        setFeePaid(Boolean(draft.deliveryFeePaid));
        setDeliveryCheckoutSessionId(draft.deliveryCheckoutSessionId || null);
        setCouponCode(draft.couponCode || "");
        setDiscountCents(typeof draft.discountCents === "number" ? draft.discountCents : 0);
        if (draft.receiptImageData) {
          setReceiptPreview(draft.receiptImageData);
          setReceiptImageData(draft.receiptImageData);
          if (receiptObjectUrl.current) {
            URL.revokeObjectURL(receiptObjectUrl.current);
            receiptObjectUrl.current = null;
          }
        }

        const receiptItems = Array.isArray(draft.receiptItems) ? draft.receiptItems : [];
        if (receiptItems.length || draft.receiptVendor || draft.receiptLocation) {
          setReceiptAnalysis({
            vendorName: draft.receiptVendor || draft.restaurantName || "Detected Restaurant",
            location:
              draft.receiptLocation ||
              inferLocation(draft.pickupAddress, draft.dropoffAddress),
            items: receiptItems,
            authenticityScore:
              typeof draft.receiptAuthenticityScore === "number"
                ? draft.receiptAuthenticityScore
                : 0.9,
            authenticityReason: "Draft restored",
            imageData: draft.receiptImageData || undefined,
          });
        }

        const hasReceiptItems = receiptItems.length > 0;
        const hasRestaurantInfo = Boolean(draft.restaurantName || draft.receiptVendor);
        const nextStep =
          draft.serviceType !== "FOOD"
            ? "details"
            : hasReceiptItems
              ? "review"
              : hasRestaurantInfo
                ? "receipt"
                : "restaurant";
        setStep(nextStep);

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

  function buildDraftPayload() {
    if (!pickupAddress || !dropoffAddress) return null;
    const receiptItems = receiptAnalysis ? receiptAnalysis.items : [];

    const payload: Record<string, unknown> = {
      draftId: draftId || undefined,
      serviceType,
      pickupAddress: pickupAddress.formattedAddress,
      dropoffAddress: dropoffAddress.formattedAddress,
      notes: notes.trim() || undefined,
      restaurantName: restaurantName.trim() || undefined,
      restaurantWebsite: restaurantWebsite.trim() || undefined,
      receiptImageData: receiptAnalysis?.imageData || receiptImageData || undefined,
      receiptVendor: receiptAnalysis?.vendorName || undefined,
      receiptLocation: receiptAnalysis?.location || undefined,
      receiptItems,
      receiptAuthenticityScore: receiptAnalysis?.authenticityScore,
      deliveryFeeCents,
      deliveryFeePaid: feePaid,
      couponCode: couponCode.trim() || undefined,
      discountCents,
    };

    return payload;
  }

  async function persistDraft(payload?: Record<string, unknown> | null) {
    if (!isSignedIn) return;
    const draftPayload = payload ?? buildDraftPayload();
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
  }, [
    draftLoaded,
    isSignedIn,
    pickupAddress,
    dropoffAddress,
    serviceType,
    notes,
    restaurantName,
    restaurantWebsite,
    receiptAnalysis,
    receiptPreview,
    deliveryFeeCents,
    feePaid,
    deliveryCheckoutSessionId,
    couponCode,
    discountCents,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!receiptImageData && !receiptAnalysis) {
      window.sessionStorage.removeItem(SESSION_DRAFT_KEY);
      return;
    }
    try {
      window.sessionStorage.setItem(
        SESSION_DRAFT_KEY,
        JSON.stringify({ receiptImageData, receiptAnalysis })
      );
    } catch (error) {
      console.warn("Session draft save failed:", error);
    }
  }, [receiptAnalysis, receiptImageData]);

  const receiptSubtotalCents = useMemo(
    () =>
      receiptAnalysis?.items.reduce(
        (sum, item) => sum + Math.round(item.price * 100) * Math.max(1, item.quantity),
        0
      ) ?? 0,
    [receiptAnalysis]
  );
  const orderTotalCents = receiptSubtotalCents + deliveryFeeCents;

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id");
    if (!checkout) return;

    if (checkout === "cancel") {
      toast({
        title: "Payment canceled",
        description: "You can try again when you're ready.",
      });
      setPaymentProcessing(false);
      setStep("review");
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", "/order");
      }
      return;
    }

    if (checkout === "success" && sessionId) {
      setPaymentProcessing(true);
      setStep("review");
      fetch("/api/stripe/delivery-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data?.paid) {
            setFeePaid(true);
            setDeliveryCheckoutSessionId(sessionId);
            if (typeof data.amountTotal === "number") {
              const metaDelivery = Number(data.metadata?.deliveryFeeCents);
              const metaSubtotal = Number(data.metadata?.subtotalCents);
              const baseTotal =
                (Number.isFinite(metaDelivery) ? metaDelivery : deliveryFeeCents) +
                (Number.isFinite(metaSubtotal) ? metaSubtotal : receiptSubtotalCents);
              const discount = Math.max(0, baseTotal - data.amountTotal);
              setDiscountCents(discount);
              if (Number.isFinite(metaDelivery)) {
                setDeliveryFeeCents(metaDelivery);
              }
              if (data.metadata?.couponCode) {
                setCouponCode(String(data.metadata.couponCode).toUpperCase());
              }
            }
            toast({
              title: "Payment authorized",
              description: "Payment confirmed. You can place your order now.",
            });
          } else {
            toast({
              title: "Payment not completed",
              description: "We couldn't confirm the payment. Please try again.",
              variant: "destructive",
            });
          }
        })
        .catch(() => {
          toast({
            title: "Payment verification failed",
            description: "Please try again.",
            variant: "destructive",
          });
        })
        .finally(() => {
          setPaymentProcessing(false);
          if (typeof window !== "undefined") {
            window.history.replaceState(null, "", "/order");
          }
        });
    }
  }, [orderTotalCents, router, searchParams, toast]);

  function goToNextStep() {
    if (!pickupAddress || !dropoffAddress) {
      toast({
        title: "Missing Information",
        description: "Please select both pickup and dropoff addresses from the search results.",
        variant: "destructive",
      });
      return;
    }

    if (requiresReceipt) {
      setStep("restaurant");
    } else {
      setStep("review");
    }
  }

  function resetReceipt() {
    setReceiptFile(null);
    setReceiptPreview(null);
    setReceiptImageData(null);
    setReceiptAnalysis(null);
    setAnalysisError(null);
    if (receiptObjectUrl.current) {
      URL.revokeObjectURL(receiptObjectUrl.current);
      receiptObjectUrl.current = null;
    }
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(SESSION_DRAFT_KEY);
    }
  }

  function handleReceiptSelect(file: File | null) {
    if (!file) {
      resetReceipt();
      return;
    }
    if (receiptObjectUrl.current) {
      URL.revokeObjectURL(receiptObjectUrl.current);
      receiptObjectUrl.current = null;
    }
    setReceiptFile(file);
    setReceiptImageData(null);
    setAnalysisError(null);
    setReceiptAnalysis(null);
    const previewUrl = URL.createObjectURL(file);
    receiptObjectUrl.current = previewUrl;
    setReceiptPreview(previewUrl);
    fileToDataUrl(file)
      .then((dataUrl) => setReceiptImageData(dataUrl))
      .catch((error) => {
        console.warn("Receipt preview failed:", error);
        setReceiptImageData(null);
      });
  }

  async function handleApplyCoupon() {
    const code = couponCode.trim();
    if (!code || feePaid) return;

    setCouponApplying(true);
    try {
      const response = await fetch("/api/coupons/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryFeeCents,
          subtotalCents: receiptSubtotalCents,
          couponCode: code,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error || "Invalid coupon code");
      }

      const data = await response.json();
      setCouponCode((data?.code || code).toUpperCase());
      setDiscountCents(typeof data?.discountCents === "number" ? data.discountCents : 0);
      toast({
        title: "Coupon applied",
        description: "Discount applied to your order total.",
      });
    } catch (error) {
      setDiscountCents(0);
      toast({
        title: "Coupon not applied",
        description: error instanceof Error ? error.message : "Invalid coupon code",
        variant: "destructive",
      });
    } finally {
      setCouponApplying(false);
    }
  }

  async function analyzeReceipt() {
    if (!receiptFile) {
      setAnalysisError("Upload your receipt before running analysis.");
      return;
    }

    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const buffer = await receiptFile.arrayBuffer();
      const imageData = receiptImageData || (await fileToDataUrl(receiptFile));
      setReceiptImageData(imageData);
      let ocrText = "";
      let ocrConfidence = 0;
      try {
        const ocrResult = await runOcr(receiptFile);
        ocrText = ocrResult.text;
        ocrConfidence = ocrResult.confidence;
      } catch (ocrError) {
        console.warn("Receipt OCR skipped:", ocrError);
      }

      const parsed = parseReceiptText(ocrText);
      const fallbackVendor = inferVendorName(restaurantName, receiptFile.name);
      const vendorName = parsed.vendorName || fallbackVendor;
      const fallbackLocation = inferLocation(
        pickupAddress?.formattedAddress,
        dropoffAddress?.formattedAddress
      );
      const location = parsed.location || fallbackLocation;
      const items =
        parsed.items.length > 0
          ? parsed.items
          : generateFallbackItems(await buildHash(buffer), vendorName);
      const authenticity = computeAuthenticity(ocrConfidence, receiptFile.size);

      setReceiptAnalysis({
        vendorName,
        location,
        items,
        authenticityScore: authenticity.score,
        authenticityReason: authenticity.reason,
        imageData,
      });
      toast({
        title: "Receipt analyzed",
        description: "We detected the restaurant and line items. Please review below.",
      });
    } catch (error) {
      console.error(error);
      setAnalysisError(error instanceof Error ? error.message : "Failed to analyze receipt");
      toast({
        title: "Receipt scan failed",
        description: "Try another image or retake a clearer screenshot.",
        variant: "destructive",
      });
    } finally {
      setAnalysisLoading(false);
    }
  }

  useEffect(() => {
    return () => {
      if (receiptObjectUrl.current) {
        URL.revokeObjectURL(receiptObjectUrl.current);
      }
    };
  }, []);

  function updateReceiptItem(index: number, field: keyof ReceiptItem, value: string) {
    setReceiptAnalysis((prev) => {
      if (!prev) return prev;
      const items = [...prev.items];
      const current = items[index];
      const nextValue = field === "name" ? value : Number(value) || 0;
      items[index] = { ...current, [field]: nextValue } as ReceiptItem;
      return { ...prev, items };
    });
  }

  function addReceiptItem() {
    setReceiptAnalysis((prev) => {
      const base = prev?.items ?? [];
      const items = [...base, { name: "Custom item", quantity: 1, price: 0 }];
      return prev ? { ...prev, items } : null;
    });
  }

  async function handlePayDeliveryFee() {
    if (!isSignedIn) {
      const returnUrl = encodeURIComponent("/order");
      router.push(`/sign-in?redirect_url=${returnUrl}`);
      return;
    }

    setPaymentProcessing(true);
    try {
      await persistDraft(buildDraftPayload()).catch(() => null);
      const response = await fetch("/api/stripe/delivery-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryFeeCents,
          subtotalCents: receiptSubtotalCents,
          couponCode: couponCode.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error || "Unable to start checkout");
      }

      const data = await response.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Missing checkout URL");
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Payment setup failed",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
      setPaymentProcessing(false);
    }
  }

  async function handleSubmit() {
    if (!pickupAddress || !dropoffAddress) return;
    if (requiresReceipt && !receiptAnalysis) {
      toast({
        title: "Add your receipt",
        description: "Upload and approve your receipt details before placing the order.",
        variant: "destructive",
      });
      setStep("receipt");
      return;
    }
    if (requiresReceipt && !feePaid) {
      toast({
        title: "Payment needed",
        description: "Pay the order total so we can place your order.",
        variant: "destructive",
      });
      setStep("review");
      return;
    }

    if (!isSignedIn) {
      const returnUrl = encodeURIComponent("/order");
      router.push(`/sign-in?redirect_url=${returnUrl}`);
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        serviceType,
        pickupAddress: pickupAddress.formattedAddress,
        dropoffAddress: dropoffAddress.formattedAddress,
        notes: notes.trim() || undefined,
      };

      if (requiresReceipt && receiptAnalysis) {
        payload.restaurantName = restaurantName || receiptAnalysis.vendorName;
        payload.restaurantWebsite = restaurantWebsite || undefined;
        payload.receiptImageData = receiptAnalysis.imageData || receiptPreview || undefined;
        payload.receiptVendor = receiptAnalysis.vendorName;
        payload.receiptLocation = receiptAnalysis.location;
        payload.receiptItems = receiptAnalysis.items;
        payload.receiptAuthenticityScore = receiptAnalysis.authenticityScore;
        payload.deliveryFeeCents = deliveryFeeCents;
        payload.deliveryFeePaid = feePaid;
        payload.deliveryCheckoutSessionId = deliveryCheckoutSessionId || undefined;
        payload.couponCode = couponCode.trim() || undefined;
      }

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error || "Failed to submit order");
      }

      const data = await response.json();
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(SESSION_DRAFT_KEY);
      }
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

  const detailSummary = (
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
  );

  const stepLabel = {
    details: "Request Details",
    restaurant: "Choose Restaurant",
    receipt: "Upload Receipt",
    review: "Review & Pay",
  }[step];

  return (
    <div className="otw-container otw-section min-h-[80vh] flex flex-col items-center justify-center">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-otwOffWhite">
            Request a <span className="text-otwGold">Delivery</span>
          </h1>
          <p className="text-white/60">Tell us what you need - we will handle the rest.</p>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-wide text-white/50">
          <Badge variant="outline" className="border-white/20 text-white/80 bg-white/5">
            {SERVICE_LABELS[serviceType] || serviceType}
          </Badge>
          <span>•</span>
          <span className="text-white/60">{stepLabel}</span>
        </div>

        <div className="otw-card p-6 sm:p-8 space-y-6 shadow-2xl shadow-black/50">
          {step === "details" && (
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
                  onClick={goToNextStep}
                  className="w-full bg-otwGold text-otwBlack hover:bg-otwGold/90 font-bold h-12 text-base shadow-otwGlow"
                  disabled={loading || !pickupAddress || !dropoffAddress}
                >
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === "restaurant" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-white/60">Food pickup flow</div>
                <Badge className="bg-otwGold/20 text-otwGold">Receipt required</Badge>
              </div>
              {detailSummary}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-otwGold/90 ml-1">Restaurant Name</label>
                  <Input
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    placeholder="e.g., Local Burger House"
                    className="bg-black/20 border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-otwGold/90 ml-1">Restaurant Website</label>
                  <Input
                    value={restaurantWebsite}
                    onChange={(e) => setRestaurantWebsite(e.target.value)}
                    placeholder="https://restaurant-menu.com"
                    className="bg-black/20 border-white/10"
                    type="url"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2"
                  disabled={!restaurantWebsite}
                  onClick={() => {
                    if (restaurantWebsite) window.open(restaurantWebsite, "_blank");
                  }}
                >
                  Open restaurant site <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => setStep("receipt")}
                  className="bg-otwGold text-otwBlack hover:bg-otwGold/90 gap-2"
                  disabled={!pickupAddress || !dropoffAddress}
                >
                  Upload receipt <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => setStep("details")}
                  variant="ghost"
                  className="text-white/60 hover:text-white"
                >
                  Back to details
                </Button>
              </div>
            </div>
          )}

          {step === "receipt" && (
            <div className="space-y-5">
              <div className="rounded-lg border border-white/10 bg-black/30 p-4 text-sm text-white/70 space-y-2">
                <p className="font-semibold text-otwOffWhite">Upload your paid receipt</p>
                <p>We will check that it looks real, pull the restaurant name, location, and the items you purchased. You can edit anything we find.</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/20 px-4 py-3 text-sm text-white/80 hover:border-otwGold/70 hover:text-otwGold">
                  <Upload className="h-4 w-4" />
                  <span>{receiptFile ? receiptFile.name : "Upload receipt image"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleReceiptSelect(e.target.files?.[0] || null)}
                  />
                </label>
                {receiptFile && (
                  <Button variant="ghost" size="sm" className="text-white/60" onClick={resetReceipt}>
                    <X className="mr-1 h-4 w-4" />Clear
                  </Button>
                )}
                <Button onClick={analyzeReceipt} disabled={!receiptFile || analysisLoading} className="gap-2">
                  {analysisLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Run AI receipt check
                </Button>
              </div>

              {analysisError && <p className="text-sm text-red-400">{analysisError}</p>}

              {receiptPreview && (
                <div className="space-y-2">
                  <div className="text-xs text-white/50">Receipt preview</div>
                  <img
                    src={receiptPreview}
                    alt="Receipt preview"
                    className="w-full max-w-2xl rounded-lg border border-white/10"
                  />
                </div>
              )}

      {receiptAnalysis && (
        <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
          {receiptAnalysis.authenticityScore < AUTHENTICITY_THRESHOLD && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              This receipt didn’t pass our 85% authenticity check. Please upload a clearer photo or verify the details.
            </div>
          )}
          <div className="flex items-start justify-between gap-3">
            <div>
                      <div className="text-xs text-white/50">Detected restaurant</div>
                      <Input
                        value={receiptAnalysis.vendorName}
                        onChange={(e) =>
                          setReceiptAnalysis((prev) => (prev ? { ...prev, vendorName: e.target.value } : prev))
                        }
                        className="bg-black/30 border-white/10"
                      />
                    </div>
                    <Badge className="bg-green-900 text-green-200 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {(receiptAnalysis.authenticityScore * 100).toFixed(0)}% real
                    </Badge>
                  </div>
                  <div>
                    <div className="text-xs text-white/50 mb-1">Pickup location on receipt</div>
                    <Input
                      value={receiptAnalysis.location}
                      onChange={(e) =>
                        setReceiptAnalysis((prev) => (prev ? { ...prev, location: e.target.value } : prev))
                      }
                      className="bg-black/30 border-white/10"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-white/50">Items</div>
                      <Button variant="outline" size="sm" onClick={addReceiptItem} className="border-white/20 text-white/80">
                        Add item
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {receiptAnalysis.items.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                          <Input
                            value={item.name}
                            onChange={(e) => updateReceiptItem(idx, "name", e.target.value)}
                            className="col-span-6 bg-black/30 border-white/10"
                          />
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateReceiptItem(idx, "quantity", e.target.value)}
                            className="col-span-2 bg-black/30 border-white/10"
                          />
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={item.price}
                            onChange={(e) => updateReceiptItem(idx, "price", e.target.value)}
                            className="col-span-3 bg-black/30 border-white/10"
                          />
                          <span className="col-span-1 text-right text-otwGold text-sm">
                            {formatCurrency(Math.round(item.price * 100) * Math.max(1, item.quantity))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/10 pt-3 text-sm">
                    <span className="text-white/60">Items total</span>
                    <span className="text-green-300 font-semibold">{formatCurrency(receiptSubtotalCents)}</span>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  onClick={() => setStep("review")}
                  className="bg-otwGold text-otwBlack hover:bg-otwGold/90"
                  disabled={!receiptAnalysis}
                >
                  Continue to review <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  onClick={() => setStep("restaurant")}
                  variant="ghost"
                  className="text-white/60 hover:text-white"
                >
                  Back to restaurant
                </Button>
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm text-white/50">Service Type</div>
                <div className="text-lg font-semibold text-otwOffWhite">
                  {SERVICE_LABELS[serviceType] || serviceType}
                </div>
              </div>
              {detailSummary}

              {requiresReceipt && (
                <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-white/50">Restaurant</div>
                      <div className="text-sm font-semibold text-otwOffWhite">
                        {restaurantName || receiptAnalysis?.vendorName || "Add restaurant"}
                      </div>
                      {restaurantWebsite && (
                        <a
                          href={restaurantWebsite}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-otwGold inline-flex items-center gap-1"
                        >
                          Visit menu <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <Badge className="bg-white/10 text-white/80">
                      Checkout total {formatCurrency(orderTotalCents)}
                    </Badge>
                  </div>

                  <div className="rounded-lg border border-white/5 bg-white/5 p-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Delivery fee</span>
                      <span className="text-white/80">{formatCurrency(deliveryFeeCents)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Receipt items</span>
                      <span className="text-green-300 font-semibold">
                        {receiptAnalysis ? formatCurrency(receiptSubtotalCents) : "Add receipt"}
                      </span>
                    </div>
                    {receiptAnalysis ? (
                      <ul className="space-y-1">
                        {receiptAnalysis.items.map((item, idx) => (
                          <li key={idx} className="flex items-center justify-between text-xs sm:text-sm">
                            <span className="text-white/70">
                              {item.name} <span className="text-white/40">×{item.quantity}</span>
                            </span>
                            <span className="text-otwGold">
                              {formatCurrency(Math.round(item.price * 100) * Math.max(1, item.quantity))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-white/50">Attach your receipt to continue.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs text-white/50">Coupon code</div>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        value={couponCode}
                        onChange={(e) => {
                          setCouponCode(e.target.value.toUpperCase());
                          setDiscountCents(0);
                        }}
                        placeholder="Enter code"
                        className="bg-black/20 border-white/10 flex-1 min-w-[200px]"
                        disabled={feePaid}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="border-white/20 text-white/80"
                        onClick={handleApplyCoupon}
                        disabled={feePaid || couponApplying || !couponCode.trim()}
                      >
                        Apply
                      </Button>
                    </div>
                    <div className="text-xs text-white/40">Applies to delivery + receipt total.</div>
                  </div>

                  {discountCents > 0 && (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-100">Discount applied</span>
                        <span className="text-emerald-200 font-semibold">
                          -{formatCurrency(discountCents)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-emerald-200/70 mt-1">
                        <span>Total after discount</span>
                        <span>{formatCurrency(Math.max(0, orderTotalCents - discountCents))}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={handlePayDeliveryFee}
                      disabled={paymentProcessing || feePaid}
                      className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                      {feePaid ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" /> Payment ready
                        </>
                      ) : (
                        <>
                          {paymentProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                          Pay {formatCurrency(Math.max(0, orderTotalCents - discountCents))}{" "}
                          <CreditCard className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setStep("receipt")}
                      className="border-white/20 text-white/80"
                    >
                      Edit receipt
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <Button
                  onClick={handleSubmit}
                  className="w-full bg-otwGold text-otwBlack hover:bg-otwGold/90 font-bold h-12 text-base shadow-otwGlow"
                  disabled={loading || (requiresReceipt && (!receiptAnalysis || !feePaid))}
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Place Order"}
                </Button>
                <Button
                  onClick={() => setStep(requiresReceipt ? "receipt" : "details")}
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
