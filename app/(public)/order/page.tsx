"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { authClient } from "@/lib/auth/client";
import { useCurrentUser } from "@/components/auth/use-current-user";
import { Loader2, Upload, Camera, X, CreditCard, MapPin, ArrowRight, Package, ExternalLink, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import OtwPageShell from "@/components/ui/otw/OtwPageShell";
import { AddressSearch } from "@/components/ui/address-search";
import StripePaymentForm from "@/components/stripe/StripePaymentForm";
import { GeocodedAddress, formatAddressLines, validateAddress } from "@/lib/geocoding";
import { ReceiptItem } from "@/lib/receipts/parse";
import { computeBillableReceiptSubtotalCents } from "@/lib/order-pricing";

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

type OrderDraft = {
  id: string;
  serviceType?: string | null;
  waitMinutes?: number | null;
  notes?: string | null;
  restaurantName?: string | null;
  restaurantWebsite?: string | null;
  deliveryFeeCents?: number | null;
  deliveryFeePaid?: boolean | null;
  deliveryCheckoutSessionId?: string | null;
  tipCents?: number | null;
  couponCode?: string | null;
  discountCents?: number | null;
  receiptImageData?: string | null;
  receiptVendor?: string | null;
  receiptLocation?: string | null;
  receiptItems?: ReceiptItem[] | null;
  receiptAuthenticityScore?: number | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  updatedAt?: string | null;
};

const SERVICE_LABELS: Record<string, string> = {
  FOOD: "Food Delivery",
  STORE: "Store Pickup",
  FRAGILE: "Fragile Item",
  CONCIERGE: "Concierge",
  RIDE: "Ride",
};

const AUTHENTICITY_THRESHOLD = 0.5;
const SESSION_DRAFT_KEY = "otw-order-draft-cache-v1";

function calculateMiles(a: GeocodedAddress, b: GeocodedAddress): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3959;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return Math.max(0.1, 2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
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

export default function OrderPage() {
  const session = authClient.useSession();
  const isSignedIn = !!session.data?.user;
  const { user } = useCurrentUser();
  const router = useRouter();
  const { toast } = useToast();
  const isAdmin = useMemo(() => {
    return user?.role === "ADMIN";
  }, [user]);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("details");

  const [pickupAddress, setPickupAddress] = useState<GeocodedAddress | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState<GeocodedAddress | null>(null);
  const [serviceType, setServiceType] = useState("FOOD");
  const [waitMinutes, setWaitMinutes] = useState(10);
  const [notes, setNotes] = useState("");

  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantWebsite, setRestaurantWebsite] = useState("");

  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptImageData, setReceiptImageData] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [receiptAnalysis, setReceiptAnalysis] = useState<ReceiptAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const [deliveryFeeCents, setDeliveryFeeCents] = useState(0);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [unlimitedMiles, setUnlimitedMiles] = useState<boolean>(false);
  const [milesQuote, setMilesQuote] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"STRIPE" | "MILES">("STRIPE");
  const [paymentMethodTouched, setPaymentMethodTouched] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState<number>(0);
  const [deliveryEstimateLoading, setDeliveryEstimateLoading] = useState(false);
  const [deliveryEstimateError, setDeliveryEstimateError] = useState<string | null>(null);
  const [feePaid, setFeePaid] = useState(false);
  const [deliveryCheckoutSessionId, setDeliveryCheckoutSessionId] = useState<string | null>(null);
  const [tipCents, setTipCents] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [discountCents, setDiscountCents] = useState(0);
  const [couponApplying, setCouponApplying] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<OrderDraft | null>(null);
  const [draftChoiceLoading, setDraftChoiceLoading] = useState(false);
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

  async function restoreDraft(draft: OrderDraft) {
    setDraftId(draft.id);
    setServiceType(draft.serviceType || "FOOD");
    if (typeof draft.waitMinutes === "number") {
      setWaitMinutes(Math.max(10, draft.waitMinutes));
    }
    setNotes(draft.notes || "");
    setRestaurantName(draft.restaurantName || "");
    setRestaurantWebsite(draft.restaurantWebsite || "");
    if (typeof draft.deliveryFeeCents === "number") {
      setDeliveryFeeCents(draft.deliveryFeeCents);
    }
    setFeePaid(Boolean(draft.deliveryFeePaid));
    setDeliveryCheckoutSessionId(draft.deliveryCheckoutSessionId || null);
    setTipCents(typeof draft.tipCents === "number" ? Math.max(0, Math.trunc(draft.tipCents)) : 0);
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
        vendorName: draft.receiptVendor || draft.restaurantName || "",
        location: draft.receiptLocation || "",
        items: receiptItems,
        authenticityScore:
          typeof draft.receiptAuthenticityScore === "number"
            ? draft.receiptAuthenticityScore
            : 0,
        authenticityReason: "Draft restored - run receipt check to verify.",
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
      if (restoredPickup) setPickupAddress(restoredPickup);
    }
    if (draft.dropoffAddress) {
      const restoredDropoff = await validateAddress(draft.dropoffAddress);
      if (restoredDropoff) setDropoffAddress(restoredDropoff);
    }
  }

  async function handleContinueDraft() {
    if (!pendingDraft) return;
    setDraftChoiceLoading(true);
    try {
      await restoreDraft(pendingDraft);
      setPendingDraft(null);
    } catch (error) {
      console.error("Draft restore failed:", error);
      toast({
        title: "Unable to restore draft",
        description: "Please try again or start over.",
        variant: "destructive",
      });
    } finally {
      setDraftChoiceLoading(false);
    }
  }

  async function handleStartOverDraft() {
    setDraftChoiceLoading(true);
    try {
      const response = await fetch("/api/orders/draft", {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to remove previous draft.");
      }
      setPendingDraft(null);
      setDraftId(null);
      setStep("details");
      setPickupAddress(null);
      setDropoffAddress(null);
      setServiceType("FOOD");
      setWaitMinutes(10);
      setNotes("");
      setRestaurantName("");
      setRestaurantWebsite("");
      setReceiptFile(null);
      setReceiptPreview(null);
      setReceiptImageData(null);
      setAnalysisError(null);
      setReceiptAnalysis(null);
      setDeliveryFeeCents(0);
      setMilesQuote(null);
      setPaymentMethod("STRIPE");
      setPaymentMethodTouched(false);
      setDurationMinutes(0);
      setDeliveryEstimateError(null);
      setFeePaid(false);
      setDeliveryCheckoutSessionId(null);
      setTipCents(0);
      setCouponCode("");
      setDiscountCents(0);
      if (receiptObjectUrl.current) {
        URL.revokeObjectURL(receiptObjectUrl.current);
        receiptObjectUrl.current = null;
      }
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(SESSION_DRAFT_KEY);
      }
    } catch (error) {
      console.error("Draft delete failed:", error);
      toast({
        title: "Unable to clear draft",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDraftChoiceLoading(false);
    }
  }

  const pickupLines = pickupAddress ? formatAddressLines(pickupAddress) : null;
  const dropoffLines = dropoffAddress ? formatAddressLines(dropoffAddress) : null;

  useEffect(() => {
    if (!pickupAddress || !dropoffAddress) {
      setDeliveryFeeCents(0);
      setDeliveryEstimateError(null);
      setDeliveryEstimateLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const estimate = async () => {
      setDeliveryEstimateLoading(true);
      setDeliveryEstimateError(null);

      const origin = `${pickupAddress.latitude},${pickupAddress.longitude}`;
      const destination = `${dropoffAddress.latitude},${dropoffAddress.longitude}`;

      let miles = calculateMiles(pickupAddress, dropoffAddress);
      let durationMins = Math.ceil(miles * 3);

      try {
        const routeRes = await fetch(
          `/api/navigation/route?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`,
          { signal: controller.signal }
        );
        if (routeRes.ok) {
          const routeData = await routeRes.json();
          const lengthMeters = routeData?.route?.summary?.length;
          const durationSeconds = routeData?.route?.summary?.duration;

          if (typeof lengthMeters === "number" && Number.isFinite(lengthMeters)) {
            miles = Math.max(0.1, lengthMeters / 1609.34);
          }
          if (typeof durationSeconds === "number" && Number.isFinite(durationSeconds)) {
            durationMins = Math.ceil(durationSeconds / 60);
          }
        }
      } catch (_error) {
        // fall back to coordinate distance
      }

      if (!cancelled) {
        setDurationMinutes(durationMins);
      }

      try {
        const fd = new FormData();
        fd.set("miles", String(miles));
        fd.set("durationMinutes", String(durationMins));
        fd.set("serviceType", serviceType);
        fd.set("waitMinutes", String(waitMinutes));
        const estimateRes = await fetch("/api/otw/estimate", {
          method: "POST",
          body: fd,
          signal: controller.signal,
        });
        if (!estimateRes.ok) {
          const error = await estimateRes.json().catch(() => ({}));
          throw new Error(error?.error || "Unable to calculate delivery fee.");
        }
        const data = await estimateRes.json();
        const fee = Number(data?.discountedPrice ?? data?.basePrice);
        if (!Number.isFinite(fee) || fee <= 0) {
          throw new Error("Invalid pricing response.");
        }
        if (!cancelled) {
          setDeliveryFeeCents(Math.round(fee));
          if (typeof data.serviceMiles === "number") {
            setMilesQuote(data.serviceMiles);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setDeliveryEstimateError(
            error instanceof Error ? error.message : "Unable to calculate delivery fee."
          );
        }
      } finally {
        if (!cancelled) {
          setDeliveryEstimateLoading(false);
        }
      }
    };

    estimate();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [pickupAddress, dropoffAddress, serviceType, waitMinutes]);

  useEffect(() => {
    if (!isSignedIn) return;
    if (draftLoaded) return;

    let cancelled = false;

    async function loadDraft() {
      try {
        const response = await fetch("/api/orders/draft", {
          credentials: "include",
        });
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
        if (cancelled) return;
        setPendingDraft(draft as OrderDraft);
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

  useEffect(() => {
    if (!isSignedIn) return;
    let active = true;
    fetch("/api/service-miles/wallet")
      .then((res) => res.json())
      .then((data) => {
        if (active && data.wallet) {
          setWalletBalance(data.wallet.balanceMiles);
          setUnlimitedMiles(data.unlimited);
        }
      })
      .catch((err) => console.error("Failed to fetch wallet:", err));
    return () => {
      active = false;
    };
  }, [isSignedIn]);

  const buildDraftPayload = useCallback((overrides?: {
    receiptImageData?: string | null;
    deliveryCheckoutSessionId?: string | null;
    feePaid?: boolean;
    couponCode?: string;
    discountCents?: number;
    deliveryFeeCents?: number;
    tipCents?: number;
  }) => {
    if (!pickupAddress || !dropoffAddress) return null;
    const receiptItems = receiptAnalysis ? receiptAnalysis.items : [];
    const resolvedReceiptImageData =
      overrides?.receiptImageData ?? receiptImageData ?? null;
    const resolvedCouponCode = (overrides?.couponCode ?? couponCode).trim();
    const resolvedDeliveryFeeCents = overrides?.deliveryFeeCents ?? deliveryFeeCents;
    const resolvedFeePaid = overrides?.feePaid ?? feePaid;
    const resolvedTipCents = overrides?.tipCents ?? tipCents;

    const payload: Record<string, unknown> = {
      draftId: draftId || undefined,
      serviceType,
      waitMinutes,
      pickupAddress: pickupAddress.formattedAddress,
      dropoffAddress: dropoffAddress.formattedAddress,
      notes: notes.trim() || undefined,
      restaurantName: restaurantName.trim() || undefined,
      restaurantWebsite: restaurantWebsite.trim() || undefined,
      receiptImageData: receiptAnalysis?.imageData || resolvedReceiptImageData || undefined,
      receiptVendor: receiptAnalysis?.vendorName || undefined,
      receiptLocation: receiptAnalysis?.location || undefined,
      receiptItems,
      receiptAuthenticityScore: receiptAnalysis?.authenticityScore,
      deliveryFeeCents: resolvedDeliveryFeeCents > 0 ? resolvedDeliveryFeeCents : undefined,
      deliveryFeePaid: resolvedFeePaid,
      deliveryCheckoutSessionId:
        overrides?.deliveryCheckoutSessionId ?? deliveryCheckoutSessionId ?? undefined,
      tipCents: resolvedTipCents,
      couponCode: isAdmin ? (resolvedCouponCode || undefined) : undefined,
      discountCents: isAdmin ? (overrides?.discountCents ?? discountCents) : 0,
    };

    return payload;
  }, [
    couponCode,
    deliveryCheckoutSessionId,
    deliveryFeeCents,
    discountCents,
    draftId,
    dropoffAddress,
    feePaid,
    isAdmin,
    notes,
    pickupAddress,
    receiptAnalysis,
    receiptImageData,
    restaurantName,
    restaurantWebsite,
    serviceType,
    tipCents,
  ]);

  const persistDraft = useCallback(async (payload?: Record<string, unknown> | null) => {
    if (!isSignedIn) return null;
    const draftPayload = payload ?? buildDraftPayload();
    if (!draftPayload) return null;

    const response = await fetch("/api/orders/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(draftPayload),
    });
    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      if (data?.draftId) {
        setDraftId(data.draftId);
        return data.draftId as string;
      }
    }
    return null;
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

  useEffect(() => {
    if (isAdmin) return;
    if (couponCode || discountCents) {
      setCouponCode("");
      setDiscountCents(0);
    }
  }, [couponCode, discountCents, isAdmin]);

  useEffect(() => {
    if (!feePaid) return;
    setFeePaid(false);
    setDeliveryCheckoutSessionId(null);
    persistDraft(buildDraftPayload({ feePaid: false, deliveryCheckoutSessionId: null })).catch(() => null);
  }, [buildDraftPayload, feePaid, persistDraft, tipCents]);

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
  const billableReceiptSubtotalCents = useMemo(
    () =>
      computeBillableReceiptSubtotalCents({
        serviceType,
        receiptSubtotalCents,
        receiptItems: receiptAnalysis?.items,
        receiptImageData,
      }),
    [serviceType, receiptSubtotalCents, receiptAnalysis, receiptImageData]
  );
  const orderTotalCents = billableReceiptSubtotalCents + deliveryFeeCents;
  const payableSubtotalCents = Math.max(0, orderTotalCents - discountCents);
  const payableTotalCents = payableSubtotalCents + tipCents;
  const deliveryFeeReady =
    deliveryFeeCents > 0 && !deliveryEstimateLoading && !deliveryEstimateError;
  const deliveryFeeLabel = deliveryEstimateLoading
    ? "Calculating..."
    : deliveryEstimateError
      ? "Unavailable"
      : formatCurrency(deliveryFeeCents);

  useEffect(() => {
    const milesAvailable =
      unlimitedMiles || (milesQuote !== null && walletBalance >= milesQuote);

    // Keep method valid as quote/balance changes.
    if (!milesAvailable && paymentMethod === "MILES") {
      setPaymentMethod("STRIPE");
      return;
    }

    // Before any manual choice, prefer miles to avoid unnecessary card SDK loading.
    if (!paymentMethodTouched && milesAvailable && paymentMethod === "STRIPE") {
      setPaymentMethod("MILES");
    }
  }, [milesQuote, paymentMethod, paymentMethodTouched, unlimitedMiles, walletBalance]);

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
    if (!isAdmin) return;
    const code = couponCode.trim();
    if (!code || feePaid) return;

    setCouponApplying(true);
    try {
      const response = await fetch("/api/coupons/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryFeeCents,
          subtotalCents: billableReceiptSubtotalCents,
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
    if (!isSignedIn) {
      toast({
        title: "Sign in required",
        description: "Please sign in before verifying your receipt.",
        variant: "destructive",
      });
      const returnUrl = encodeURIComponent("/order");
      router.push(`/sign-in?redirect_url=${returnUrl}`);
      return;
    }

    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const imageData = receiptImageData || (await fileToDataUrl(receiptFile));
      setReceiptImageData(imageData);
      const draftPayload = buildDraftPayload({ receiptImageData: imageData });
      if (!draftPayload) {
        throw new Error("Add pickup and dropoff details before verifying a receipt.");
      }

      const ensuredDraftId = draftId ?? (await persistDraft(draftPayload));
      if (!ensuredDraftId) {
        throw new Error("Unable to create your order draft for receipt verification.");
      }

      const formData = new FormData();
      formData.append("receipt", receiptFile);
      formData.append("deliveryRequestId", ensuredDraftId);

      const response = await fetch("/api/receipt/verify", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const result = (await response.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
        status?: string;
        riskScore?: number;
        proofScore?: number;
        reasonCodes?: string[];
        vendorName?: string | null;
        menuItems?: Array<{ name?: unknown; quantity?: unknown; price?: unknown }>;
        data?: {
          vendor?: {
            address?: unknown;
            raw_address?: unknown;
          };
        };
      };

      if (response.status === 401) {
        const returnUrl = encodeURIComponent("/order");
        router.push(`/sign-in?redirect_url=${returnUrl}`);
        return;
      }

      if (!response.ok) {
        throw new Error(result.message || result.error || "Receipt verification failed.");
      }

      const items: ReceiptItem[] = Array.isArray(result.menuItems)
        ? result.menuItems
            .map((item) => ({
              name: typeof item?.name === "string" ? item.name.trim() : "",
              quantity:
                typeof item?.quantity === "number" && Number.isFinite(item.quantity)
                  ? Math.max(1, Math.round(item.quantity))
                  : 1,
              price:
                typeof item?.price === "number" && Number.isFinite(item.price)
                  ? Math.max(0, Number(item.price.toFixed(2)))
                  : 0,
            }))
            .filter((item) => item.name.length > 0)
        : [];

      const vendorName =
        (typeof result.vendorName === "string" && result.vendorName.trim()) ||
        restaurantName.trim() ||
        "";
      const location =
        (typeof result.data?.vendor?.address === "string" && result.data.vendor.address.trim()) ||
        (typeof result.data?.vendor?.raw_address === "string" && result.data.vendor.raw_address.trim()) ||
        pickupAddress?.formattedAddress ||
        "";
      const scoreSource =
        typeof result.riskScore === "number"
          ? result.riskScore
          : typeof result.proofScore === "number"
            ? result.proofScore
            : 0;
      const authenticityScore = Math.max(0, Math.min(1, scoreSource / 100));
      const reasonCodes = Array.isArray(result.reasonCodes)
        ? result.reasonCodes.filter((code): code is string => typeof code === "string" && code.length > 0)
        : [];
      const authenticityReason = reasonCodes.length
        ? `Veryfi ${result.status || "PROCESSED"}: ${reasonCodes.join(", ")}`
        : `Veryfi ${result.status || "PROCESSED"}`;

      setReceiptAnalysis({
        vendorName,
        location,
        items,
        authenticityScore,
        authenticityReason,
        imageData,
      });
      if (!restaurantName.trim() && vendorName) {
        setRestaurantName(vendorName);
      }
      toast({
        title: "Receipt verified",
        description: "Veryfi parsed your receipt and scored it. Review the details below.",
      });
    } catch (error) {
      console.error(error);
      setAnalysisError(error instanceof Error ? error.message : "Failed to verify receipt");
      toast({
        title: "Receipt verification failed",
        description: "Try another image or retake a clearer photo.",
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
      const items = [...base, { name: "", quantity: 1, price: 0 }];
      return prev ? { ...prev, items } : null;
    });
  }

  async function ensureReceiptImageData() {
    if (receiptImageData) return receiptImageData;
    if (receiptAnalysis?.imageData) {
      setReceiptImageData(receiptAnalysis.imageData);
      return receiptAnalysis.imageData;
    }
    if (receiptFile) {
      try {
        const dataUrl = await fileToDataUrl(receiptFile);
        setReceiptImageData(dataUrl);
        if (!receiptPreview || receiptPreview.startsWith("blob:")) {
          setReceiptPreview(dataUrl);
        }
        return dataUrl;
      } catch (error) {
        console.warn("Receipt image cache failed:", error);
      }
    }
    return null;
  }

  // Stable handlers for StripePaymentForm to prevent infinite re-renders
  const handleSuccessRef = useRef<(id: string) => Promise<void>>(async () => {});
  const handleErrorRef = useRef<(err: string) => void>(() => {});

  useEffect(() => {
    handleSuccessRef.current = async (paymentIntentId: string) => {
      try {
        const cachedImageData = await ensureReceiptImageData();
        
        setFeePaid(true);
        setDeliveryCheckoutSessionId(paymentIntentId);
        
        await persistDraft(
          buildDraftPayload({
            deliveryCheckoutSessionId: paymentIntentId,
            feePaid: true,
            receiptImageData: cachedImageData,
          })
        ).catch(() => null);

        toast({
          title: "Payment successful",
          description: "Your delivery payment is ready. You can place your order.",
        });
      } catch (error) {
        console.error(error);
        toast({
          title: "Error",
          description: "Payment succeeded but failed to update order. Please contact support.",
          variant: "destructive",
        });
      }
    };

    handleErrorRef.current = (error: string) => {
      toast({
        title: "Payment failed",
        description: error || "Please try again.",
        variant: "destructive",
      });
    };
  });

  const handleStripePaymentSuccess = useCallback((id: string) => handleSuccessRef.current(id), []);
  const handleStripePaymentError = useCallback((err: string) => handleErrorRef.current(err), []);

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
    if (paymentMethod === "STRIPE" && !feePaid) {
      toast({
        title: "Payment needed",
        description: "Pay the order total so we can place your order.",
        variant: "destructive",
      });
      setStep("review");
      return;
    }

    if (paymentMethod === "MILES") {
      if (!unlimitedMiles && milesQuote && walletBalance < milesQuote) {
        toast({
          title: "Insufficient Miles",
          description: "You do not have enough miles for this delivery.",
          variant: "destructive",
        });
        return;
      }
    }

    if (!isSignedIn) {
      const returnUrl = encodeURIComponent("/order");
      router.push(`/sign-in?redirect_url=${returnUrl}`);
      return;
    }

    let hasServerSession = false;
    try {
      const sessionResponse = await fetch("/api/auth/me", {
        credentials: "include",
        cache: "no-store",
      });
      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json().catch(() => null);
        hasServerSession = Boolean(sessionData?.user?.id);
      }
    } catch {
      hasServerSession = false;
    }

    if (!hasServerSession) {
      toast({
        title: "Session expired",
        description: "Please sign in again to place your order.",
        variant: "destructive",
      });
      const returnUrl = encodeURIComponent("/order");
      router.push(`/sign-in?redirect_url=${returnUrl}`);
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        draftId: draftId || undefined,
        serviceType,
        pickupAddress: pickupAddress.formattedAddress,
        dropoffAddress: dropoffAddress.formattedAddress,
        notes: notes.trim() || undefined,
        deliveryFeeCents: deliveryFeeCents,
        deliveryFeePaid: paymentMethod === "STRIPE" ? feePaid : false,
        payWithMiles: paymentMethod === "MILES",
        travelMinutes: durationMinutes,
        waitMinutes: waitMinutes,
        paymentId: deliveryCheckoutSessionId || undefined,
        couponCode: isAdmin ? (couponCode.trim() || undefined) : undefined,
        tipCents,
      };

      if (requiresReceipt && receiptAnalysis) {
        payload.restaurantName = restaurantName || receiptAnalysis.vendorName;
        payload.restaurantWebsite = restaurantWebsite || undefined;
        payload.receiptImageData = receiptAnalysis.imageData || receiptPreview || undefined;
        payload.receiptVendor = receiptAnalysis.vendorName;
        payload.receiptLocation = receiptAnalysis.location;
        payload.receiptItems = receiptAnalysis.items;
        payload.receiptAuthenticityScore = receiptAnalysis.authenticityScore;
      }

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (response.redirected && response.url.includes("/sign-in")) {
        const returnUrl = encodeURIComponent("/order");
        router.push(`/sign-in?redirect_url=${returnUrl}`);
        return;
      }

      if (response.status === 401) {
        toast({
          title: "Session expired",
          description: "Please sign in again to place your order.",
          variant: "destructive",
        });
        const returnUrl = encodeURIComponent("/order");
        router.push(`/sign-in?redirect_url=${returnUrl}`);
        return;
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error || "Failed to submit order");
      }

      const data = await response.json();
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(SESSION_DRAFT_KEY);
      }
      router.push(`/order/${data.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
      toast({
        title: "Submission Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  if (pendingDraft) {
    const lastSavedLabel =
      pendingDraft.updatedAt && !Number.isNaN(Date.parse(pendingDraft.updatedAt))
        ? new Date(pendingDraft.updatedAt).toLocaleString()
        : null;

    return (
      <OtwPageShell className="flex flex-col items-center justify-center min-h-[75vh]">
        <div className="w-full max-w-2xl space-y-6">
          <Card className="p-6 sm:p-8 space-y-5">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">Continue previous order?</h1>
              <p className="text-sm text-muted-foreground">
                We found an unfinished request draft in your account.
                {lastSavedLabel ? ` Last saved ${lastSavedLabel}.` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleContinueDraft}
                disabled={draftChoiceLoading}
                className="gap-2"
              >
                {draftChoiceLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Continue previous order
              </Button>
              <Button
                variant="outline"
                onClick={handleStartOverDraft}
                disabled={draftChoiceLoading}
              >
                Start over
              </Button>
            </div>
          </Card>
        </div>
      </OtwPageShell>
    );
  }

  const detailSummary = (
    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/40 p-4">
      <div>
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pickup</div>
        <div className="text-sm font-medium">{pickupLines?.primary}</div>
        {pickupLines?.secondary && <div className="text-xs text-muted-foreground">{pickupLines.secondary}</div>}
      </div>
      <div>
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Dropoff</div>
        <div className="text-sm font-medium">{dropoffLines?.primary}</div>
        {dropoffLines?.secondary && <div className="text-xs text-muted-foreground">{dropoffLines.secondary}</div>}
      </div>
      {notes.trim() && (
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Notes</div>
          <div className="text-sm text-foreground/80">{notes}</div>
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
    <OtwPageShell className="flex flex-col items-center justify-center min-h-[75vh]">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-3">
          <Badge variant="secondary">Customer Request</Badge>
          <h1 className="text-4xl font-semibold tracking-tight">
            Request a <span className="text-secondary">Delivery</span>
          </h1>
          <p className="text-muted-foreground">Tell us what you need - we will handle the rest.</p>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <Badge variant="outline">
            {SERVICE_LABELS[serviceType] || serviceType}
          </Badge>
          <span>•</span>
          <span className="text-muted-foreground">{stepLabel}</span>
        </div>

        <Card className="p-6 sm:p-8 space-y-6">
          {step === "details" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground ml-1">Pickup Address</label>
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
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground ml-1">Dropoff Address</label>
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
                    <option value="STORE">Grocery / Store</option>
                    <option value="FRAGILE">Fragile / Important</option>
                    <option value="CONCIERGE">Custom Concierge</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground ml-1">
                  Wait Time (Min)
                </label>
                <div className="relative">
                   <div className="flex items-center space-x-2">
                    <Input
                      type="number"
                      min={10}
                      step={1}
                      value={waitMinutes}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) setWaitMinutes(Math.max(10, val));
                      }}
                      className="w-full"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      mins
                    </span>
                   </div>
                   <p className="text-[10px] text-muted-foreground mt-1 ml-1">
                     Minimum 10 minutes.
                   </p>
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

              <div className="pt-2">
                <Button
                  onClick={goToNextStep}
                  className="w-full"
                  disabled={loading || !pickupAddress || !dropoffAddress}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === "restaurant" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Food pickup flow</div>
                <span className="inline-flex items-center rounded-full border border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 px-2.5 py-0.5 text-xs font-semibold transition-colors">Receipt required</span>
              </div>
              {detailSummary}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground ml-1">Restaurant Name</label>
                  <Input
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground ml-1">Restaurant Website</label>
                  <Input
                    value={restaurantWebsite}
                    onChange={(e) => setRestaurantWebsite(e.target.value)}
                    type="url"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
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
                  className="gap-2"
                  disabled={!pickupAddress || !dropoffAddress}
                >
                  Upload receipt <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => setStep("details")}
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Back to details
                </Button>
              </div>
            </div>
          )}

          {step === "receipt" && (
            <div className="space-y-5">
              <div className="rounded-lg border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground space-y-2">
                <p className="font-semibold text-foreground">Upload your paid receipt</p>
                <p>We will check that it looks real, pull the restaurant name, location, and the items you purchased. You can edit anything we find.</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border/70 px-4 py-3 text-sm text-muted-foreground transition-colors duration-300 hover:border-secondary/70 hover:text-secondary">
                  <Upload className="h-4 w-4" />
                  <span>{receiptFile ? receiptFile.name : "Upload receipt image"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => handleReceiptSelect(e.target.files?.[0] || null)}
                  />
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border/70 px-4 py-3 text-sm text-muted-foreground transition-colors duration-300 hover:border-secondary/70 hover:text-secondary">
                  <Camera className="h-4 w-4" />
                  <span>Take photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={(e) => handleReceiptSelect(e.target.files?.[0] || null)}
                  />
                </label>
                {receiptFile && (
                  <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={resetReceipt}>
                    <X className="mr-1 h-4 w-4" />Clear
                  </Button>
                )}
                <Button
                  onClick={analyzeReceipt}
                  disabled={!receiptFile || analysisLoading}
                  className="gap-2"
                >
                  {analysisLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Run Veryfi receipt check
                </Button>
              </div>

              {analysisError && <p className="text-sm text-red-400">{analysisError}</p>}

              {receiptPreview && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Receipt preview</div>
                  <Image
                    src={receiptPreview}
                    alt="Receipt preview"
                    width={1200}
                    height={900}
                    className="w-full max-w-2xl rounded-lg border border-border/70"
                    unoptimized
                    loader={({ src }) => src}
                  />
                </div>
              )}

      {receiptAnalysis && (
        <div className="space-y-4 rounded-lg border border-border/70 bg-muted/40 p-4">
          {receiptAnalysis.authenticityScore < AUTHENTICITY_THRESHOLD && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              This receipt was flagged by verification. Please upload a clearer photo or verify the details.
            </div>
          )}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-muted-foreground">Restaurant name</div>
              <Input
                value={receiptAnalysis.vendorName}
                onChange={(e) =>
                  setReceiptAnalysis((prev) => (prev ? { ...prev, vendorName: e.target.value } : prev))
                }
              />
            </div>
            <span className="inline-flex items-center rounded-full border border-transparent bg-green-500/20 text-green-400 px-2.5 py-0.5 text-xs font-semibold transition-colors gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {(receiptAnalysis.authenticityScore * 100).toFixed(0)}% real
            </span>
          </div>
          {receiptAnalysis.authenticityReason && (
            <div className="text-xs text-muted-foreground">{receiptAnalysis.authenticityReason}</div>
          )}
          <div>
              <div className="text-xs text-muted-foreground mb-1">Pickup location on receipt</div>
            <Input
              value={receiptAnalysis.location}
              onChange={(e) =>
                setReceiptAnalysis((prev) => (prev ? { ...prev, location: e.target.value } : prev))
              }
            />
          </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">Items</div>
                      <Button variant="outline" size="sm" onClick={addReceiptItem}>
                        Add item
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {receiptAnalysis.items.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                          <Input
                            value={item.name}
                            onChange={(e) => updateReceiptItem(idx, "name", e.target.value)}
                            className="col-span-6"
                          />
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateReceiptItem(idx, "quantity", e.target.value)}
                            className="col-span-2"
                          />
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={item.price}
                            onChange={(e) => updateReceiptItem(idx, "price", e.target.value)}
                            className="col-span-3"
                          />
                          <span className="col-span-1 text-right text-otwGold text-sm">
                            {formatCurrency(Math.round(item.price * 100) * Math.max(1, item.quantity))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/70 pt-3 text-sm">
                    <span className="text-muted-foreground">Items total</span>
                    <span className="text-secondary font-semibold">{formatCurrency(receiptSubtotalCents)}</span>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  onClick={() => setStep("review")}
                  className="gap-2"
                  disabled={!receiptAnalysis}
                >
                  Continue to review <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  onClick={() => setStep("restaurant")}
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Back to restaurant
                </Button>
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Service Type</div>
                <div className="text-lg font-semibold text-foreground">
                  {SERVICE_LABELS[serviceType] || serviceType}
                </div>
              </div>
              {detailSummary}

              {/* Payment Block - Always visible */}
              <div className="rounded-xl border border-border/70 bg-muted/40 p-4 space-y-3">
                {requiresReceipt && (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Restaurant</div>
                      <div className="text-sm font-semibold text-foreground">
                        {restaurantName || receiptAnalysis?.vendorName || "Restaurant name required"}
                      </div>
                      {restaurantWebsite && (
                        <a
                          href={restaurantWebsite}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-secondary inline-flex items-center gap-1"
                        >
                          Visit menu <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <Badge variant="outline">
                      Checkout total {deliveryFeeReady ? formatCurrency(orderTotalCents) : "Pending estimate"}
                    </Badge>
                  </div>
                )}

                <div className="rounded-lg border border-border/70 bg-card/80 p-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Delivery fee</span>
                    <span className="text-foreground/80">{deliveryFeeLabel}</span>
                  </div>
                  {requiresReceipt && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Receipt items</span>
                        <span className="text-secondary font-semibold">
                          {receiptAnalysis ? formatCurrency(receiptSubtotalCents) : "Add receipt"}
                        </span>
                      </div>
                      {receiptAnalysis ? (
                        <ul className="space-y-1">
                          {receiptAnalysis.items.map((item, idx) => (
                            <li key={idx} className="flex items-center justify-between text-xs sm:text-sm">
                              <span className="text-foreground/70">
                                {item.name} <span className="text-muted-foreground">×{item.quantity}</span>
                              </span>
                              <span className="text-otwGold">
                                {formatCurrency(Math.round(item.price * 100) * Math.max(1, item.quantity))}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground">Attach your receipt to continue.</p>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        Receipt items are tracked for verification and only charged on cash deliveries.
                      </p>
                    </>
                  )}
                </div>
                {deliveryEstimateLoading && (
                  <div className="text-xs text-muted-foreground">Calculating delivery fee…</div>
                )}
                {deliveryEstimateError && (
                  <div className="text-xs text-red-400">{deliveryEstimateError}</div>
                )}

                {isAdmin ? (
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Admin discount code</div>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        value={couponCode}
                        onChange={(e) => {
                          setCouponCode(e.target.value.toUpperCase());
                          setDiscountCents(0);
                        }}
                        className="flex-1 min-w-[200px]"
                        disabled={feePaid}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleApplyCoupon}
                        disabled={feePaid || couponApplying || !couponCode.trim()}
                      >
                        Apply
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Applies to {requiresReceipt ? "the billable delivery total" : "delivery fee"}.
                    </div>
                  </div>
                ) : null}

                {isAdmin && discountCents > 0 && (
                  <div className="rounded-lg border border-secondary/30 bg-secondary/10 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-secondary/90">Discount applied</span>
                      <span className="text-secondary font-semibold">
                        -{formatCurrency(discountCents)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-secondary/70 mt-1">
                      <span>Total after discount</span>
                      <span>{formatCurrency(Math.max(0, orderTotalCents - discountCents))}</span>
                    </div>
                  </div>
                )}

                {feePaid ? (
                  <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4 text-center text-green-600">
                    <div className="flex items-center justify-center gap-2 font-semibold">
                      <CheckCircle2 className="h-5 w-5" /> Payment Completed
                    </div>
                    <p className="text-xs opacity-80 mt-1">Your payment method has been verified.</p>
                  </div>
                ) : deliveryFeeReady ? (
                  <div className="rounded-lg border border-border/70 bg-card/80 p-4 space-y-4">
                    {(milesQuote !== null || unlimitedMiles) && (
                      <div className="space-y-3 pb-4 border-b border-border/50">
                        <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                          Payment Method
                        </Label>
                        <RadioGroup
                          value={paymentMethod}
                          onValueChange={(val) => {
                            setPaymentMethodTouched(true);
                            setPaymentMethod(val as "STRIPE" | "MILES");
                          }}
                          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                        >
                          <div
                            className={`flex items-center space-x-2 rounded-lg border p-3 ${
                              paymentMethod === "STRIPE" ? "border-primary bg-primary/5" : "border-border"
                            }`}
                          >
                            <RadioGroupItem value="STRIPE" id="pm-stripe" />
                            <Label htmlFor="pm-stripe" className="flex-1 cursor-pointer">
                              <div className="font-medium">Credit Card</div>
                              <div className="text-xs text-muted-foreground">Pay with Stripe</div>
                            </Label>
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                          </div>

                          <div
                            className={`flex items-center space-x-2 rounded-lg border p-3 ${
                              paymentMethod === "MILES" ? "border-primary bg-primary/5" : "border-border"
                            } ${
                              !unlimitedMiles && (!milesQuote || walletBalance < milesQuote)
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                            }`}
                          >
                            <RadioGroupItem
                              value="MILES"
                              id="pm-miles"
                              disabled={!unlimitedMiles && (!milesQuote || walletBalance < milesQuote)}
                            />
                            <Label htmlFor="pm-miles" className="flex-1 cursor-pointer">
                              <div className="font-medium">Service Miles</div>
                              <div className="text-xs text-muted-foreground">
                                {unlimitedMiles ? "Unlimited" : `${milesQuote ?? "?"} miles`}
                                {!unlimitedMiles && milesQuote && walletBalance < milesQuote && (
                                  <span className="block text-red-400">
                                    Insufficient balance ({walletBalance})
                                  </span>
                                )}
                              </div>
                            </Label>
                            <Package className="h-4 w-4 text-otwGold" />
                          </div>
                        </RadioGroup>
                      </div>
                    )}

                    {paymentMethod === "STRIPE" ? (
                      <>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <CreditCard className="h-4 w-4" />
                          <span>Pay securely with Stripe</span>
                        </div>
                        <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">Tip (100% to driver)</div>
                            <div className="text-sm font-semibold">{formatCurrency(tipCents)}</div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {[0, 200, 500, 1000].map((v) => (
                              <Button
                                key={v}
                                type="button"
                                variant={tipCents === v ? "default" : "outline"}
                                onClick={() => setTipCents(v)}
                                className="h-8 text-xs"
                                disabled={feePaid}
                              >
                                {v === 0 ? "No tip" : formatCurrency(v)}
                              </Button>
                            ))}
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Custom</span>
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                value={Math.round(tipCents / 100)}
                                onChange={(e) => {
                                  const dollars = Number(e.target.value);
                                  const cents = Number.isFinite(dollars)
                                    ? Math.max(0, Math.trunc(dollars)) * 100
                                    : 0;
                                  setTipCents(cents);
                                }}
                                className="h-8 w-24"
                                disabled={feePaid}
                              />
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            Tips are logged separately and paid out to the driver.
                          </div>
                        </div>
                        <StripePaymentForm
                          amountCents={payableTotalCents}
                          couponCode={isAdmin ? couponCode : undefined}
                          tipCents={tipCents}
                          onSuccess={handleStripePaymentSuccess}
                          onError={handleStripePaymentError}
                        />
                      </>
                    ) : (
                      <div className="rounded-lg border border-otwGold/30 bg-otwGold/10 p-4 text-center">
                        <div className="flex items-center justify-center gap-2 font-semibold text-otwGold">
                          <Package className="h-5 w-5" /> Pay with Service Miles
                        </div>
                        <p className="text-xs opacity-80 mt-1">
                          {unlimitedMiles
                            ? "Your membership covers this delivery."
                            : `${milesQuote} miles will be deducted from your wallet.`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Tips can be paid in cash to the driver.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center p-4 text-muted-foreground text-sm border rounded-lg border-dashed">
                    {deliveryEstimateLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Calculating delivery fee...
                      </span>
                    ) : (
                      "Pending delivery fee estimate..."
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  {requiresReceipt && (
                    <Button
                      variant="outline"
                      onClick={() => setStep("receipt")}
                      className="w-full"
                    >
                      Edit receipt
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <Button
                  onClick={handleSubmit}
                  className="w-full"
                  disabled={loading || (requiresReceipt && !receiptAnalysis) || (paymentMethod === "STRIPE" && !feePaid)}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Place Order
                </Button>
                <Button
                  onClick={() => setStep(requiresReceipt ? "receipt" : "details")}
                  variant="ghost"
                  className="w-full text-muted-foreground hover:text-foreground"
                  disabled={loading}
                >
                  Edit Details
                </Button>
              </div>
            </div>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          By proceeding, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </OtwPageShell>
  );
}
