'use client';

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Loader2, MapPin, Plus, Search, X } from 'lucide-react';
import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import { BackNavButton } from '@/components/layout/BackNavButton';
import { useCurrentUser } from '@/components/auth/use-current-user';
import { AddressSearch } from '@/components/ui/address-search';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { formatAddressLines, validateAddress, type GeocodedAddress } from '@/lib/geocoding';
import { downscaleImage } from '@/lib/image/downscale';
import { getMembershipPlanPerks } from '@/lib/membership-perks';
import { calculateRequestRouteMiles } from '@/lib/request-stops';

const PICKUP_CODE_TYPES = [
  { value: '', label: 'None' },
  { value: 'QR', label: 'QR' },
  { value: 'BARCODE', label: 'Barcode' },
  { value: 'PIN', label: 'PIN' },
  { value: 'CONFIRMATION', label: 'Confirmation' },
];

type ServiceType = 'FOOD' | 'STORE' | 'FRAGILE' | 'CONCIERGE' | 'RIDE';
type OtwTrueBenefitType = 'FOOD_JOB_SITE' | 'COMMUTE_RIDE' | 'ROADSIDE_ASSIST';

type Base64StatusResponse = {
  base64Mode?: boolean;
  uploadsAllowed?: boolean;
};

type PaymentPreference = 'INSTANT' | 'MONTHLY';

type OtwTrueJobSiteBusiness = {
  ownerUserId: string;
  businessLegalName: string;
  validatedAddress?: string | null;
  primaryBusinessStreetAddress: string;
  primaryBusinessCity: string;
  primaryBusinessStateProvince: string;
  primaryBusinessPostalCode: string;
  primaryBusinessCountry: string;
};

type ServiceMilesWalletResponse = {
  plan?: {
    name?: string | null;
    priorityLevel?: number | null;
    cashAllowed?: boolean | null;
    peerToPeerAllowed?: boolean | null;
    markupFree?: boolean | null;
    overageBillingMode?: 'INSTANT' | 'INVOICE' | null;
  } | null;
  otwTrue?: {
    employeeId: string;
    ownerUserId: string;
    ownerName: string | null;
    ownerEmail: string;
    jobSiteBusiness?: OtwTrueJobSiteBusiness | null;
    benefitYear: number;
    usage: {
      freeFoodDeliveriesUsed: number;
      commuteRidesUsed: number;
      roadsideAssistsUsed: number;
    };
    remaining: {
      commuteRides: number;
      roadsideAssists: number;
    };
  } | null;
};

const DEFAULT_SCHEDULE_WINDOW_MINUTES = 30;
const DEFAULT_SCHEDULE_PRESET_MINUTES_AHEAD = 120;

function toLocalDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toLocalTimeValue(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function buildScheduledForIso(dateValue: string, timeValue: string): string | null {
  if (!dateValue || !timeValue) return null;
  const candidate = new Date(`${dateValue}T${timeValue}`);
  if (Number.isNaN(candidate.getTime())) return null;
  return candidate.toISOString();
}

function buildJobSiteBusinessAddressLabel(business: OtwTrueJobSiteBusiness): string {
  const validatedAddress = business.validatedAddress?.trim();
  if (validatedAddress) {
    return validatedAddress;
  }

  const addressParts = buildJobSiteBusinessValidationAddressParts(business);
  return addressParts.join(', ');
}

function buildJobSiteBusinessValidationAddressParts(business: OtwTrueJobSiteBusiness): string[] {
  const cityStatePostal = [
    business.primaryBusinessCity,
    business.primaryBusinessStateProvince,
    business.primaryBusinessPostalCode,
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' ');

  return [
    business.primaryBusinessStreetAddress,
    cityStatePostal,
    business.primaryBusinessCountry && business.primaryBusinessCountry !== 'US'
      ? business.primaryBusinessCountry
      : null,
  ]
    .map((value) => value?.trim() ?? '')
    .filter(Boolean);
}

function buildJobSiteBusinessValidationAddress(business: OtwTrueJobSiteBusiness): string {
  const addressParts = buildJobSiteBusinessValidationAddressParts(business);
  return addressParts.length > 0 ? addressParts.join(', ') : buildJobSiteBusinessAddressLabel(business);
}

function buildJobSiteBusinessSearchText(business: OtwTrueJobSiteBusiness): string {
  return [
    business.businessLegalName,
    business.validatedAddress,
    business.primaryBusinessStreetAddress,
    business.primaryBusinessCity,
    business.primaryBusinessStateProvince,
    business.primaryBusinessPostalCode,
    business.primaryBusinessCountry,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function isSameJobSiteBusiness(
  left: OtwTrueJobSiteBusiness | null | undefined,
  right: OtwTrueJobSiteBusiness | null | undefined,
): boolean {
  if (!left || !right) return false;
  return (
    left.ownerUserId === right.ownerUserId &&
    left.businessLegalName === right.businessLegalName &&
    left.validatedAddress === right.validatedAddress &&
    left.primaryBusinessStreetAddress === right.primaryBusinessStreetAddress &&
    left.primaryBusinessCity === right.primaryBusinessCity &&
    left.primaryBusinessStateProvince === right.primaryBusinessStateProvince &&
    left.primaryBusinessPostalCode === right.primaryBusinessPostalCode &&
    left.primaryBusinessCountry === right.primaryBusinessCountry
  );
}

export default function OrderPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isSignedIn, isLoading } = useCurrentUser();

  const pickupPassEnabled = process.env.NEXT_PUBLIC_FEATURE_PICKUP_PASS !== 'false';

  const [pickupAddress, setPickupAddress] = useState<GeocodedAddress | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState<GeocodedAddress | null>(null);
  const [intermediateStops, setIntermediateStops] = useState<Array<GeocodedAddress | null>>([]);
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
  const [membershipPlan, setMembershipPlan] = useState<ServiceMilesWalletResponse['plan']>(null);
  const [otwTrueEntitlement, setOtwTrueEntitlement] = useState<ServiceMilesWalletResponse['otwTrue']>(null);
  const [otwTrueBenefitType, setOtwTrueBenefitType] = useState<OtwTrueBenefitType | ''>('');
  const [jobSiteBusinessQuery, setJobSiteBusinessQuery] = useState('');
  const [selectedJobSiteBusiness, setSelectedJobSiteBusiness] = useState<OtwTrueJobSiteBusiness | null>(null);
  const [isResolvingJobSiteBusiness, setIsResolvingJobSiteBusiness] = useState(false);
  const [deliveryTiming, setDeliveryTiming] = useState<'ASAP' | 'SCHEDULED'>('ASAP');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

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
  const planPerks = useMemo(() => getMembershipPlanPerks(membershipPlan), [membershipPlan]);
  const resolvedIntermediateStops = useMemo(
    () => intermediateStops.filter((stop): stop is GeocodedAddress => Boolean(stop)),
    [intermediateStops],
  );
  const hasIncompleteIntermediateStops = intermediateStops.some((stop) => !stop);
  const isFoodJobSiteBenefit = otwTrueBenefitType === 'FOOD_JOB_SITE';
  const availableJobSiteBusinesses = useMemo(
    () => (otwTrueEntitlement?.jobSiteBusiness ? [otwTrueEntitlement.jobSiteBusiness] : []),
    [otwTrueEntitlement?.jobSiteBusiness],
  );
  const filteredJobSiteBusinesses = useMemo(() => {
    const normalizedQuery = jobSiteBusinessQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return availableJobSiteBusinesses;
    }

    return availableJobSiteBusinesses.filter((business) =>
      buildJobSiteBusinessSearchText(business).includes(normalizedQuery),
    );
  }, [availableJobSiteBusinesses, jobSiteBusinessQuery]);
  const isBusinessSearchEmpty =
    isFoodJobSiteBenefit &&
    jobSiteBusinessQuery.trim().length > 0 &&
    filteredJobSiteBusinesses.length === 0;
  const missingJobSiteBusinessProfile =
    isFoodJobSiteBenefit && availableJobSiteBusinesses.length === 0;

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
      setMembershipPlan(null);
      setOtwTrueEntitlement(null);
      setOtwTrueBenefitType('');
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

        const monthlyAllowed = getMembershipPlanPerks(payload?.plan).canUseMonthlyBilling;
        setMembershipPlan(payload?.plan ?? null);
        setCanChooseMonthlyPayments(monthlyAllowed);
        if (!monthlyAllowed) {
          setPaymentPreference('INSTANT');
        }
        setOtwTrueEntitlement(payload?.otwTrue ?? null);
        if (!payload?.otwTrue) {
          setOtwTrueBenefitType('');
        }
      })
      .catch(() => {
        if (!isActive) {
          return;
        }
        setMembershipPlan(null);
        setCanChooseMonthlyPayments(false);
        setPaymentPreference('INSTANT');
        setOtwTrueEntitlement(null);
        setOtwTrueBenefitType('');
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

  useEffect(() => {
    if (!planPerks.canUseMultiStop && intermediateStops.length > 0) {
      setIntermediateStops([]);
    }
  }, [intermediateStops.length, planPerks.canUseMultiStop]);

  useEffect(() => {
    if (deliveryTiming !== 'SCHEDULED') {
      return;
    }
    if (scheduledDate && scheduledTime) {
      return;
    }

    const seed = new Date(Date.now() + DEFAULT_SCHEDULE_PRESET_MINUTES_AHEAD * 60 * 1000);
    const roundedMinutes = Math.ceil(seed.getMinutes() / 5) * 5;
    seed.setMinutes(roundedMinutes, 0, 0);
    setScheduledDate(toLocalDateValue(seed));
    setScheduledTime(toLocalTimeValue(seed));
  }, [deliveryTiming, scheduledDate, scheduledTime]);

  useEffect(() => {
    if (otwTrueBenefitType === 'FOOD_JOB_SITE' && serviceType !== 'FOOD') {
      setServiceType('FOOD');
      return;
    }

    if (otwTrueBenefitType === 'COMMUTE_RIDE' && serviceType !== 'RIDE') {
      setServiceType('RIDE');
      return;
    }

    if (
      otwTrueBenefitType === 'ROADSIDE_ASSIST' &&
      serviceType !== 'RIDE' &&
      serviceType !== 'CONCIERGE'
    ) {
      setServiceType('RIDE');
    }
  }, [otwTrueBenefitType, serviceType]);

  useEffect(() => {
    if (!isFoodJobSiteBenefit) {
      setJobSiteBusinessQuery('');
      setSelectedJobSiteBusiness(null);
      setIsResolvingJobSiteBusiness(false);
      return;
    }

    const defaultBusiness = availableJobSiteBusinesses[0] ?? null;
    if (!defaultBusiness) {
      setSelectedJobSiteBusiness(null);
      setDropoffAddress(null);
      return;
    }

    if (isSameJobSiteBusiness(selectedJobSiteBusiness, defaultBusiness)) {
      return;
    }

    let isActive = true;
    setSelectedJobSiteBusiness(defaultBusiness);
    setJobSiteBusinessQuery((current) => current || defaultBusiness.businessLegalName);
    setIsResolvingJobSiteBusiness(true);

    void validateAddress(buildJobSiteBusinessValidationAddress(defaultBusiness))
      .then((resolvedAddress) => {
        if (!isActive) return;
        if (!resolvedAddress) {
          setDropoffAddress(null);
          toast({
            title: 'Business address unavailable',
            description:
              'We could not verify the saved OTW True business address. Ask the business owner to update Membership Manage.',
            variant: 'destructive',
          });
          return;
        }

        setDropoffAddress({
          ...resolvedAddress,
          placeName: defaultBusiness.businessLegalName,
        });
      })
      .catch(() => {
        if (!isActive) return;
        setDropoffAddress(null);
        toast({
          title: 'Business address unavailable',
          description:
            'We could not verify the saved OTW True business address. Ask the business owner to update Membership Manage.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        if (isActive) {
          setIsResolvingJobSiteBusiness(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [availableJobSiteBusinesses, isFoodJobSiteBenefit, selectedJobSiteBusiness, toast]);

  const handleJobSiteBusinessSelect = async (business: OtwTrueJobSiteBusiness) => {
    setSelectedJobSiteBusiness(business);
    setJobSiteBusinessQuery(business.businessLegalName);
    setIsResolvingJobSiteBusiness(true);

    try {
      const resolvedAddress = await validateAddress(buildJobSiteBusinessValidationAddress(business));
      if (!resolvedAddress) {
        setDropoffAddress(null);
        toast({
          title: 'Business address unavailable',
          description:
            'We could not verify the saved OTW True business address. Ask the business owner to update Membership Manage.',
          variant: 'destructive',
        });
        return;
      }

      setDropoffAddress({
        ...resolvedAddress,
        placeName: business.businessLegalName,
      });
    } catch {
      setDropoffAddress(null);
      toast({
        title: 'Business address unavailable',
        description:
          'We could not verify the saved OTW True business address. Ask the business owner to update Membership Manage.',
        variant: 'destructive',
      });
    } finally {
      setIsResolvingJobSiteBusiness(false);
    }
  };

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isSignedIn || !user) {
      router.push('/sign-in');
      return;
    }

    if (isFoodJobSiteBenefit && !selectedJobSiteBusiness) {
      toast({
        title: 'Business required',
        description: 'Select your OTW True job-site business before submitting this request.',
        variant: 'destructive',
      });
      return;
    }

    if (isFoodJobSiteBenefit && isResolvingJobSiteBusiness) {
      toast({
        title: 'Verifying business address',
        description: 'Please wait for the saved business dropoff address to finish loading.',
        variant: 'destructive',
      });
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
    if (hasIncompleteIntermediateStops) {
      toast({
        title: 'Finish your stop list',
        description: 'Select an address for each added stop or remove the empty stop before submitting.',
        variant: 'destructive',
      });
      return;
    }

    const isScheduled = deliveryTiming === 'SCHEDULED';
    let scheduledForIso: string | null = null;
    if (isScheduled) {
      scheduledForIso = buildScheduledForIso(scheduledDate, scheduledTime);
      if (!scheduledForIso) {
        toast({
          title: 'Schedule required',
          description: 'Choose a valid date and time for your scheduled request.',
          variant: 'destructive',
        });
        return;
      }
      if (new Date(scheduledForIso).getTime() <= Date.now()) {
        toast({
          title: 'Schedule must be in the future',
          description: 'Select a future date and time.',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const routePoints = [pickupAddress, ...resolvedIntermediateStops, dropoffAddress].map((stop) => ({
        lat: stop.latitude,
        lng: stop.longitude,
      }));
      const milesEstimate = calculateRequestRouteMiles(routePoints);

      const createResponse = await fetch('/api/requests', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickup: pickupAddress.formattedAddress,
          dropoff: dropoffAddress.formattedAddress,
          pickupLat: pickupAddress.latitude,
          pickupLng: pickupAddress.longitude,
          pickupLabel: pickupAddress.placeName || undefined,
          dropoffLat: dropoffAddress.latitude,
          dropoffLng: dropoffAddress.longitude,
          dropoffLabel: dropoffAddress.placeName || undefined,
          intermediateStops: resolvedIntermediateStops.map((stop) => ({
            address: stop.formattedAddress,
            lat: stop.latitude,
            lng: stop.longitude,
            label: stop.placeName || undefined,
          })),
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
          otwTrueBenefitType: otwTrueBenefitType || undefined,
          isScheduled,
          scheduledFor: scheduledForIso ?? undefined,
          scheduleWindowMinutes: DEFAULT_SCHEDULE_WINDOW_MINUTES,
        }),
      });

      const createPayload = (await createResponse.json().catch(() => null)) as {
        id?: string;
        paymentRequired?: boolean;
        deliveryPaymentRequired?: boolean;
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
      const requiresPayment = Boolean(
        createPayload.paymentRequired || createPayload.deliveryPaymentRequired,
      );

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
        title: requiresPayment ? 'Request created' : 'Request submitted',
        description: requiresPayment
          ? 'Complete payment to unlock dispatch for this request.'
          : 'Your delivery request has been created.',
      });

      router.push(requiresPayment ? `/pay/${deliveryRequestId}` : `/request/${deliveryRequestId}`);
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
      <div className="mb-4 flex items-center gap-2">
        <BackNavButton fallbackHref="/" className="h-9 px-3" />
        <OtwButton as="a" href="/" variant="ghost" size="sm" className="h-9 px-3">
          Home
        </OtwButton>
      </div>
      <OtwSectionHeader
        title="Order Delivery"
        subtitle={planPerks.canUseMultiStop ? 'Create a delivery request with optional intermediate stops' : 'Create a core pickup-and-delivery request'}
      />

      <div className="mt-6 mx-auto w-full max-w-3xl space-y-6">
        <OtwCard className="border-otwGold/30 bg-otwGold/10">
          <h2 className="text-base font-semibold text-white">Pickup &amp; Delivery Only</h2>
          <p className="mt-2 text-sm text-white/80">
            OTW does not place or pay for your order.
            Please order and pay directly with the restaurant or store before requesting delivery.
            Add the order name/number or upload a pickup QR code so your driver can pick it up smoothly.
            {planPerks.canUseMultiStop
              ? ' OTW Elite+ members can also add intermediate stops before the final dropoff.'
              : null}
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

            {isFoodJobSiteBenefit ? (
              <div className="space-y-4 rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
                    Job-Site Business
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-100/70" />
                    <Input
                      value={jobSiteBusinessQuery}
                      onChange={(event) => setJobSiteBusinessQuery(event.target.value)}
                      placeholder="Search by business name or saved address"
                      className="border-emerald-300/20 bg-black/20 pl-10 pr-10 text-white placeholder:text-white/40"
                    />
                    {isResolvingJobSiteBusiness ? (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-emerald-100/70" />
                    ) : null}
                  </div>

                  {missingJobSiteBusinessProfile ? (
                    <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-200">
                      Your linked OTW True business has not saved a job-site address yet. Ask the business owner to
                      update Membership Manage before using this benefit.
                    </div>
                  ) : filteredJobSiteBusinesses.length > 0 ? (
                    <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-2">
                      {filteredJobSiteBusinesses.map((business) => {
                        const isSelected = isSameJobSiteBusiness(selectedJobSiteBusiness, business);
                        return (
                          <button
                            key={`${business.ownerUserId}-${business.businessLegalName}`}
                            type="button"
                            onClick={() => {
                              void handleJobSiteBusinessSelect(business);
                            }}
                            className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                              isSelected
                                ? 'border-emerald-300/40 bg-emerald-500/10'
                                : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/30'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <Building2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-200" />
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-white">
                                  {business.businessLegalName}
                                </div>
                                <div className="mt-1 text-xs text-white/65">
                                  {buildJobSiteBusinessAddressLabel(business)}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : isBusinessSearchEmpty ? (
                    <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/60">
                      No linked OTW True business matches that search. Try the business name or saved address.
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
                    Dropoff Address
                  </label>
                  {dropoffLines ? (
                    <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/80">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-otwGold" />
                        {dropoffLines.primary}
                      </div>
                      {dropoffLines.secondary ? (
                        <div className="mt-1 text-white/55">{dropoffLines.secondary}</div>
                      ) : null}
                      <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-emerald-200/80">
                        Locked to the business profile location on file
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-white/15 bg-black/10 p-3 text-xs text-white/55">
                      Select your job-site business to load the saved dropoff location.
                    </div>
                  )}
                </div>
              </div>
            ) : (
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
            )}

            {planPerks.canUseMultiStop ? (
              <div className="space-y-3 rounded-lg border border-otwGold/25 bg-otwGold/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Intermediate Stops</h3>
                    <p className="mt-1 text-xs text-white/70">
                      Add any extra stops between pickup and the final dropoff.
                    </p>
                  </div>
                  <OtwButton
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIntermediateStops((current) => [...current, null])}
                    className="border-white/20 bg-black/20 text-white hover:bg-black/30"
                  >
                    <Plus className="h-4 w-4" />
                    Add stop
                  </OtwButton>
                </div>

                {intermediateStops.length > 0 ? (
                  <div className="space-y-3">
                    {intermediateStops.map((stop, index) => {
                      const stopLines = stop ? formatAddressLines(stop) : null;
                      return (
                        <div key={`stop-${index}`} className="rounded-lg border border-white/10 bg-black/20 p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                              Stop {index + 1}
                            </div>
                            <OtwButton
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setIntermediateStops((current) =>
                                  current.filter((_entry, currentIndex) => currentIndex !== index),
                                )
                              }
                              className="h-8 px-2 text-white/70 hover:text-white"
                            >
                              <X className="h-4 w-4" />
                            </OtwButton>
                          </div>
                          <AddressSearch
                            ariaLabel={`Intermediate stop ${index + 1}`}
                            enableCurrentLocation
                            onSelect={(address) => {
                              setIntermediateStops((current) =>
                                current.map((entry, currentIndex) =>
                                  currentIndex === index ? address : entry,
                                ),
                              );
                            }}
                            className="w-full"
                          />
                          {stopLines ? (
                            <div className="mt-2 rounded-lg border border-white/10 bg-black/30 p-2 text-xs text-white/75">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5 text-otwGold" />
                                {stopLines.primary}
                              </div>
                              {stopLines.secondary ? (
                                <div className="mt-1 text-white/55">{stopLines.secondary}</div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="mt-2 text-xs text-white/50">
                              Select the address for this stop.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-white/15 bg-black/10 p-3 text-xs text-white/55">
                    No intermediate stops added. Your route will go straight from pickup to the final dropoff.
                  </div>
                )}
              </div>
            ) : isSignedIn && !isCheckingPaymentPolicy ? (
              <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/60">
                Multi-stop requests unlock on OTW Elite and above.
              </div>
            ) : null}

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
                  <option value="RIDE">Ride</option>
                </Select>
              </div>
            </div>

            {otwTrueEntitlement ? (
              <div className="space-y-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                  OTW True Employee Benefit
                </label>
                <Select
                  value={otwTrueBenefitType}
                  onChange={(event) => setOtwTrueBenefitType(event.target.value as OtwTrueBenefitType | '')}
                  className="bg-black/30 text-white"
                >
                  <option value="">Do not apply OTW True benefit</option>
                  <option value="FOOD_JOB_SITE">Free job-site food delivery</option>
                  <option
                    value="COMMUTE_RIDE"
                    disabled={otwTrueEntitlement.remaining.commuteRides <= 0}
                  >
                    Commute ride ({otwTrueEntitlement.remaining.commuteRides} remaining this year)
                  </option>
                  <option
                    value="ROADSIDE_ASSIST"
                    disabled={otwTrueEntitlement.remaining.roadsideAssists <= 0}
                  >
                    Roadside assist ({otwTrueEntitlement.remaining.roadsideAssists} remaining this year)
                  </option>
                </Select>
                <p className="text-xs text-emerald-100/80">
                  Linked to {otwTrueEntitlement.ownerName || otwTrueEntitlement.ownerEmail}. OTW True benefits make
                  the selected request complimentary.
                </p>
              </div>
            ) : null}

            <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                Delivery Timing
              </label>
              <Select
                value={deliveryTiming}
                onChange={(event) => setDeliveryTiming(event.target.value as 'ASAP' | 'SCHEDULED')}
                className="bg-black/30 text-white"
              >
                <option value="ASAP">ASAP</option>
                <option value="SCHEDULED">Schedule for later</option>
              </Select>
              {deliveryTiming === 'SCHEDULED' ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs text-white/60">Date</label>
                    <Input
                      type="date"
                      value={scheduledDate}
                      min={toLocalDateValue(new Date())}
                      onChange={(event) => setScheduledDate(event.target.value)}
                      className="bg-black/30 text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-white/60">Time</label>
                    <Input
                      type="time"
                      value={scheduledTime}
                      onChange={(event) => setScheduledTime(event.target.value)}
                      className="bg-black/30 text-white"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-white/60">We will dispatch as soon as payment is complete.</p>
              )}
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
                    <option value="MONTHLY">Monthly billing</option>
                  </Select>
                  <p className="text-xs text-white/55">
                    Eligible plans can choose instant payment or monthly billing.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-white/65">
                  Your current plan requires payment before dispatch when a balance is due.
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
                disabled={
                  isSubmitting ||
                  isLoading ||
                  !isSignedIn ||
                  isOptimizingPickupPass ||
                  hasIncompleteIntermediateStops ||
                  isResolvingJobSiteBusiness ||
                  missingJobSiteBusinessProfile
                }
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
