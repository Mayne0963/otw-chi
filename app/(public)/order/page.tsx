'use client';

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Loader2 } from 'lucide-react';
import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import { useCurrentUser } from '@/components/auth/use-current-user';
import { AddressSearch } from '@/components/ui/address-search';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { formatAddressLines, type GeocodedAddress } from '@/lib/geocoding';
import { downscaleImage } from '@/lib/image/downscale';

const PICKUP_CODE_TYPES = [
  { value: '', label: 'None' },
  { value: 'QR', label: 'QR' },
  { value: 'BARCODE', label: 'Barcode' },
  { value: 'PIN', label: 'PIN' },
  { value: 'CONFIRMATION', label: 'Confirmation' },
];

type ServiceType = 'FOOD' | 'STORE' | 'FRAGILE' | 'CONCIERGE';

type Base64StatusResponse = {
  base64Mode?: boolean;
  uploadsAllowed?: boolean;
};

type PaymentPreference = 'INSTANT' | 'MONTHLY';

type ServiceMilesWalletResponse = {
  plan?: {
    name?: string | null;
  } | null;
};

function canChooseMonthlyByPlanName(planName: string | null | undefined): boolean {
  const normalized = planName?.toUpperCase().trim() ?? '';
  return (
    normalized === 'OTW ELITE' ||
    normalized === 'OTW BLACK' ||
    normalized.startsWith('OTW BUSINESS')
  );
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMiles = 3959;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return Math.max(0.1, 2 * earthRadiusMiles * Math.asin(Math.min(1, Math.sqrt(a))));
}

export default function OrderPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isSignedIn, isLoading } = useCurrentUser();

  const pickupPassEnabled = process.env.NEXT_PUBLIC_FEATURE_PICKUP_PASS !== 'false';

  const [pickupAddress, setPickupAddress] = useState<GeocodedAddress | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState<GeocodedAddress | null>(null);
  const [serviceType, setServiceType] = useState<ServiceType>('FOOD');
  const [notes, setNotes] = useState('');

  const [orderReference, setOrderReference] = useState('');
  const [pickupInstructions, setPickupInstructions] = useState('');
  const [dropoffInstructions, setDropoffInstructions] = useState('');
  const [pickupCodeType, setPickupCodeType] = useState('');
  const [pickupCodeText, setPickupCodeText] = useState('');
  const [pickupPassFile, setPickupPassFile] = useState<File | null>(null);
  const [pickupPassPreviewUrl, setPickupPassPreviewUrl] = useState<string | null>(null);
  const [isOptimizingPickupPass, setIsOptimizingPickupPass] = useState(false);
  const [isCheckingUploadStatus, setIsCheckingUploadStatus] = useState(false);
  const [base64Mode, setBase64Mode] = useState(false);
  const [uploadsAllowed, setUploadsAllowed] = useState(true);
  const [paymentPreference, setPaymentPreference] = useState<PaymentPreference>('INSTANT');
  const [canChooseMonthlyPayments, setCanChooseMonthlyPayments] = useState(false);
  const [isCheckingPaymentPolicy, setIsCheckingPaymentPolicy] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const uploadsPaused = pickupPassEnabled && base64Mode && !uploadsAllowed;

  const pickupLines = useMemo(
    () => (pickupAddress ? formatAddressLines(pickupAddress) : null),
    [pickupAddress],
  );
  const dropoffLines = useMemo(
    () => (dropoffAddress ? formatAddressLines(dropoffAddress) : null),
    [dropoffAddress],
  );

  useEffect(() => {
    if (!pickupPassFile) {
      setPickupPassPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(pickupPassFile);
    setPickupPassPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [pickupPassFile]);

  useEffect(() => {
    if (!pickupPassEnabled) {
      return;
    }

    const controller = new AbortController();
    let isActive = true;
    setIsCheckingUploadStatus(true);

    void fetch('/api/storage/base64-status', {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to load base64 upload status');
        }
        const payload = (await response.json()) as Base64StatusResponse;
        if (!isActive) {
          return;
        }

        setBase64Mode(Boolean(payload.base64Mode));
        setUploadsAllowed(payload.uploadsAllowed !== false);
      })
      .catch(() => {
        if (!isActive) {
          return;
        }
        setBase64Mode(false);
        setUploadsAllowed(true);
      })
      .finally(() => {
        if (isActive) {
          setIsCheckingUploadStatus(false);
        }
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [pickupPassEnabled]);

  useEffect(() => {
    if (!isSignedIn) {
      setCanChooseMonthlyPayments(false);
      setPaymentPreference('INSTANT');
      setIsCheckingPaymentPolicy(false);
      return;
    }

    const controller = new AbortController();
    let isActive = true;
    setIsCheckingPaymentPolicy(true);

    void fetch('/api/service-miles/wallet', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to load payment policy');
        }
        const payload = (await response.json().catch(() => ({}))) as ServiceMilesWalletResponse;
        if (!isActive) {
          return;
        }

        const monthlyAllowed = canChooseMonthlyByPlanName(payload?.plan?.name);
        setCanChooseMonthlyPayments(monthlyAllowed);
        if (!monthlyAllowed) {
          setPaymentPreference('INSTANT');
        }
      })
      .catch(() => {
        if (!isActive) {
          return;
        }
        setCanChooseMonthlyPayments(false);
        setPaymentPreference('INSTANT');
      })
      .finally(() => {
        if (isActive) {
          setIsCheckingPaymentPolicy(false);
        }
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [isSignedIn]);

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isSignedIn || !user) {
      router.push('/sign-in');
      return;
    }

    if (!pickupAddress || !dropoffAddress) {
      toast({
        title: 'Missing address',
        description: 'Please select both pickup and dropoff addresses.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const milesEstimate = haversineMiles(
        pickupAddress.latitude,
        pickupAddress.longitude,
        dropoffAddress.latitude,
        dropoffAddress.longitude,
      );

      const createResponse = await fetch('/api/requests', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickup: pickupAddress.formattedAddress,
          dropoff: dropoffAddress.formattedAddress,
          serviceType,
          notes: notes.trim() || undefined,
          milesEstimate,
          costEstimate: Math.max(1, Math.round(milesEstimate * 100)),
          orderReference: orderReference.trim() || undefined,
          pickupInstructions: pickupInstructions.trim() || undefined,
          dropoffInstructions: dropoffInstructions.trim() || undefined,
          pickupCodeType: pickupCodeType || undefined,
          pickupCodeText: pickupCodeText.trim() || undefined,
          paymentPreference: canChooseMonthlyPayments ? paymentPreference : 'INSTANT',
        }),
      });

      const createPayload = (await createResponse.json().catch(() => null)) as {
        id?: string;
        paymentRequired?: boolean;
        deliveryClientSecret?: string | null;
        deliveryPaymentIntentId?: string | null;
        error?: string;
        message?: string;
      } | null;

      if (!createResponse.ok) {
        throw new Error(
          createPayload?.error || createPayload?.message || 'Unable to create request',
        );
      }

      if (!createPayload?.id) {
        throw new Error('Unable to create request');
      }

      const deliveryRequestId = createPayload.id;

      if (pickupPassEnabled && pickupPassFile) {
        if (uploadsPaused) {
          toast({
            title: 'Pickup pass upload paused',
            description:
              'Uploads are temporarily paused. Please paste your pickup code or confirmation number.',
            variant: 'destructive',
          });
        } else {
          const uploadForm = new FormData();
          uploadForm.set('deliveryRequestId', deliveryRequestId);
          uploadForm.set('file', pickupPassFile);

          const uploadResponse = await fetch('/api/upload/pickup-pass', {
            method: 'POST',
            body: uploadForm,
          });

          if (!uploadResponse.ok) {
            const uploadPayload = (await uploadResponse.json().catch(() => ({}))) as {
              error?: string;
              message?: string;
            };
            toast({
              title: 'Request created, pickup pass failed',
              description:
                uploadPayload.message ||
                uploadPayload.error ||
                'You can upload the pickup pass from request details.',
              variant: 'destructive',
            });
          }
        }
      }

      toast({
        title: createPayload.paymentRequired ? 'Request created' : 'Request submitted',
        description: createPayload.paymentRequired
          ? 'Complete payment to unlock dispatch for this request.'
          : 'Your delivery request has been created.',
      });

      router.push(createPayload.paymentRequired ? `/pay/${deliveryRequestId}` : `/requests/${deliveryRequestId}`);
    } catch (error) {
      toast({
        title: 'Unable to submit request',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePickupPassFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    event.target.value = '';

    if (!selected) {
      setPickupPassFile(null);
      return;
    }

    setIsOptimizingPickupPass(true);
    try {
      const optimized = await downscaleImage(selected, { maxWidth: 1200, quality: 0.75 });
      setPickupPassFile(optimized);
    } catch {
      setPickupPassFile(selected);
      toast({
        title: 'Unable to optimize image',
        description: 'Using original image file.',
        variant: 'destructive',
      });
    } finally {
      setIsOptimizingPickupPass(false);
    }
  };

  return (
    <OtwPageShell>
      <OtwSectionHeader
        title="Order Delivery"
        subtitle="Create a core pickup-and-delivery request"
      />

      <div className="mt-6 mx-auto w-full max-w-3xl space-y-6">
        <OtwCard className="border-otwGold/30 bg-otwGold/10">
          <h2 className="text-base font-semibold text-white">Pickup &amp; Delivery Only</h2>
          <p className="mt-2 text-sm text-white/80">
            OTW does not place or pay for your order.
            Please order and pay directly with the restaurant or store before requesting delivery.
            Add the order name/number or upload a pickup QR code so your driver can pick it up smoothly.
          </p>
        </OtwCard>

        <OtwCard>
          <form className="space-y-5" onSubmit={submitRequest}>
            {!isSignedIn && !isLoading ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                Sign in to submit a delivery request.
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Pickup Address</label>
              <AddressSearch
                ariaLabel="Pickup address"
                enableCurrentLocation
                onSelect={setPickupAddress}
                className="w-full"
              />
              {pickupLines ? (
                <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-white/75">
                  <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-otwGold" />{pickupLines.primary}</div>
                  {pickupLines.secondary ? <div className="mt-1 text-white/55">{pickupLines.secondary}</div> : null}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Dropoff Address</label>
              <AddressSearch
                ariaLabel="Dropoff address"
                enableCurrentLocation
                onSelect={setDropoffAddress}
                className="w-full"
              />
              {dropoffLines ? (
                <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-white/75">
                  <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-otwGold" />{dropoffLines.primary}</div>
                  {dropoffLines.secondary ? <div className="mt-1 text-white/55">{dropoffLines.secondary}</div> : null}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Service Type</label>
                <Select
                  value={serviceType}
                  onChange={(event) => setServiceType(event.target.value as ServiceType)}
                  className="bg-black/20 text-white"
                >
                  <option value="FOOD">Food Pickup</option>
                  <option value="STORE">Store / Grocery</option>
                  <option value="FRAGILE">Fragile Delivery</option>
                  <option value="CONCIERGE">Concierge</option>
                </Select>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Payment Timing</label>
              {isCheckingPaymentPolicy ? (
                <p className="text-xs text-white/60">Checking your plan payment options...</p>
              ) : canChooseMonthlyPayments ? (
                <div className="space-y-2">
                  <Select
                    value={paymentPreference}
                    onChange={(event) => setPaymentPreference(event.target.value as PaymentPreference)}
                    className="bg-black/30 text-white"
                  >
                    <option value="INSTANT">Pay instantly (required before dispatch)</option>
                    <option value="MONTHLY">Monthly billing (use service miles first)</option>
                  </Select>
                  <p className="text-xs text-white/55">
                    Elite, Black, and Business plans can choose instant payment or monthly billing.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-white/65">
                  Your current plan requires instant payment for each request.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Pickup Instructions</label>
              <Textarea
                value={pickupInstructions}
                onChange={(event) => setPickupInstructions(event.target.value)}
                placeholder="Counter, locker, or handoff details"
                className="min-h-[90px] bg-black/20 text-white"
                maxLength={2000}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Dropoff Instructions</label>
              <Textarea
                value={dropoffInstructions}
                onChange={(event) => setDropoffInstructions(event.target.value)}
                placeholder="Door, gate code, floor, concierge details"
                className="min-h-[90px] bg-black/20 text-white"
                maxLength={2000}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Notes (Optional)</label>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Anything your driver should know"
                className="min-h-[90px] bg-black/20 text-white"
                maxLength={1500}
              />
            </div>

            {pickupPassEnabled ? (
              <div className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Pickup Pass (Optional)</h3>
                  <p className="mt-1 text-xs text-white/65">
                    If the merchant provides a QR code, barcode, PIN, or confirmation screen, you can add it here.
                    This is used only for pickup and is not a receipt.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-white/60">Order Name / Confirmation Number</label>
                  <Input
                    value={orderReference}
                    onChange={(event) => setOrderReference(event.target.value)}
                    placeholder="Pickup under Carlton / Order #1234"
                    className="bg-black/30 text-white"
                    maxLength={120}
                  />
                  <p className="text-xs text-white/55">
                    Example: Pickup under Carlton or Order #4582
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs text-white/60">Pickup Code Type</label>
                    <Select
                      value={pickupCodeType}
                      onChange={(event) => setPickupCodeType(event.target.value)}
                      className="bg-black/30 text-white"
                    >
                      {PICKUP_CODE_TYPES.map((option) => (
                        <option key={option.value || 'none'} value={option.value}>{option.label}</option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-white/60">Pickup Code Text</label>
                    <Input
                      value={pickupCodeText}
                      onChange={(event) => setPickupCodeText(event.target.value)}
                      placeholder="PIN / confirmation code"
                      className="bg-black/30 text-white"
                      maxLength={255}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-white/60">Upload QR / Barcode Screenshot</label>
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => {
                      void handlePickupPassFileSelection(event);
                    }}
                    disabled={isOptimizingPickupPass || uploadsPaused}
                    className="bg-black/30 text-white file:mr-3 file:rounded file:border file:border-white/20 file:bg-white/10 file:px-2 file:py-1 file:text-xs"
                  />
                  {isCheckingUploadStatus ? (
                    <p className="text-xs text-white/60">Checking upload status...</p>
                  ) : null}
                  {uploadsPaused ? (
                    <p className="text-xs text-yellow-300">
                      Uploads are temporarily paused. Please paste your pickup code or confirmation number.
                    </p>
                  ) : null}
                  {isOptimizingPickupPass ? (
                    <p className="text-xs text-white/60">Optimizing image...</p>
                  ) : null}
                </div>

                {pickupPassPreviewUrl ? (
                  <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                    <div className="text-xs text-white/60">Preview</div>
                    <img
                      src={pickupPassPreviewUrl}
                      alt="Pickup pass preview"
                      className="mt-2 max-h-56 w-auto rounded border border-white/10"
                    />
                    <div className="mt-2">
                      <OtwButton
                        type="button"
                        variant="outline"
                        onClick={() => setPickupPassFile(null)}
                      >
                        Remove Screenshot
                      </OtwButton>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex justify-end">
              <OtwButton
                type="submit"
                variant="gold"
                disabled={isSubmitting || isLoading || !isSignedIn || isOptimizingPickupPass}
              >
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Submitting...</>
                ) : (
                  'Submit Delivery Request'
                )}
              </OtwButton>
            </div>
          </form>
        </OtwCard>
      </div>
    </OtwPageShell>
  );
}
