"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ServiceType } from '@prisma/client';
import { AddressSearch } from '@/components/ui/address-search';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import StripePaymentForm from '@/components/stripe/StripePaymentForm';
import { formatAddressLines, type GeocodedAddress } from '@/lib/geocoding';
import { getMembershipPlanPerks } from '@/lib/membership-perks';

type QuoteResponse = {
  quote: {
    estimatedMinutes: number;
    serviceMilesFinal: number;
    quoteBreakdown: {
      baseMiles: number;
      adders: {
        waitTime: number;
        sitAndWaitPremium: number;
        multiStop: number;
        returnExchange: number;
        cashHandling: number;
        peakHours: number;
      };
      discount: { hoursInAdvance: number; percentage: number; amount: number };
      subtotal: number;
      final: number;
    };
  };
  quotedAt: string;
  quoteToken: string;
};

type WalletResponse = {
  membership: { status: string; currentPeriodEnd: string | null } | null;
  plan: {
    name: string;
    priorityLevel: number;
    cashAllowed: boolean;
    peerToPeerAllowed: boolean;
    markupFree: boolean;
    overageBillingMode: 'INSTANT' | 'INVOICE';
  } | null;
  wallet: { balanceMiles: number; rolloverBankMiles: number };
  unlimited: boolean;
};

type PreferredDriversResponse = {
  drivers: Array<{ id: string; name: string }>;
};

type SubmitResponse = {
  id: string;
  paymentPreference?: 'INSTANT' | 'MONTHLY';
  paymentRequired?: boolean;
  deliveryPaymentRequired?: boolean;
  deliveryFeeCents?: number | null;
  deliveryClientSecret?: string | null;
  deliveryPaymentIntentId?: string | null;
  overageMiles?: number;
  overageCents?: number;
  overageClientSecret?: string | null;
};

type PaymentPreference = 'INSTANT' | 'MONTHLY';

async function fetchRouteMinutes(origin: GeocodedAddress, destination: GeocodedAddress): Promise<number> {
  const originParam = `${origin.latitude},${origin.longitude}`;
  const destParam = `${destination.latitude},${destination.longitude}`;
  const res = await fetch(
    `/api/navigation/route?origin=${encodeURIComponent(originParam)}&destination=${encodeURIComponent(destParam)}`,
    { method: 'GET' }
  );
  if (!res.ok) throw new Error('Route estimate failed');
  const data = await res.json();
  const durationSeconds = data?.route?.summary?.duration;
  if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error('Invalid route duration');
  }
  return Math.max(1, Math.ceil(durationSeconds / 60));
}

export function ServiceMilesCalculator() {
  const router = useRouter();
  const { toast } = useToast();

  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);

  const [pickupAddress, setPickupAddress] = useState<GeocodedAddress | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState<GeocodedAddress | null>(null);
  const pickupLines = pickupAddress ? formatAddressLines(pickupAddress) : null;
  const dropoffLines = dropoffAddress ? formatAddressLines(dropoffAddress) : null;

  const [serviceType, setServiceType] = useState<ServiceType>(ServiceType.FOOD);
  const [scheduledStart, setScheduledStart] = useState<string>(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });

  const [prioritySlot, setPrioritySlot] = useState(false);
  const [lockToPreferred, setLockToPreferred] = useState(false);
  const [preferredDriverId, setPreferredDriverId] = useState<string>('');
  const [preferredDrivers, setPreferredDrivers] = useState<PreferredDriversResponse | null>(null);

  const [waitMinutes, setWaitMinutes] = useState(0);
  const [sitAndWait, setSitAndWait] = useState(false);
  const [numberOfStops, setNumberOfStops] = useState(1);
  const [returnOrExchange, setReturnOrExchange] = useState(false);
  const [cashHandling, setCashHandling] = useState(false);
  const [peakHours, setPeakHours] = useState(false);
  const [notes, setNotes] = useState('');

  const [travelMinutes, setTravelMinutes] = useState<number | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [overagePayment, setOveragePayment] = useState<{
    requestId: string;
    amountCents: number;
    clientSecret: string;
  } | null>(null);
  const [paymentPreference, setPaymentPreference] = useState<PaymentPreference>('INSTANT');

  useEffect(() => {
    let cancelled = false;
    setWalletLoading(true);
    fetch('/api/service-miles/wallet')
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || 'Failed to load wallet');
        }
        return res.json() as Promise<WalletResponse>;
      })
      .then((data) => {
        if (!cancelled) setWallet(data);
      })
      .catch((error) => {
        if (cancelled) return;
        toast({
          title: 'Wallet unavailable',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        if (!cancelled) setWalletLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const planPerks = useMemo(() => getMembershipPlanPerks(wallet?.plan), [wallet?.plan]);
  const eligibleForPriority = planPerks.canUsePrioritySlot;
  const canChooseMonthlyPayments = planPerks.canUseMonthlyBilling;

  useEffect(() => {
    if (!canChooseMonthlyPayments) {
      setPaymentPreference('INSTANT');
    }
  }, [canChooseMonthlyPayments]);

  useEffect(() => {
    if (!planPerks.canUseSitAndWait) {
      setSitAndWait(false);
    }
    if (!planPerks.canUseMultiStop) {
      setNumberOfStops(1);
    }
    if (!planPerks.canUseReturnOrExchange) {
      setReturnOrExchange(false);
    }
    if (!planPerks.canUseCashHandling) {
      setCashHandling(false);
    }
    if (!planPerks.canLockPreferredDriver) {
      setLockToPreferred(false);
    }
  }, [
    planPerks.canLockPreferredDriver,
    planPerks.canUseCashHandling,
    planPerks.canUseMultiStop,
    planPerks.canUseReturnOrExchange,
    planPerks.canUseSitAndWait,
  ]);

  useEffect(() => {
    if (!eligibleForPriority) {
      setPrioritySlot(false);
    }
    if (!planPerks.canLockPreferredDriver) {
      setLockToPreferred(false);
      setPreferredDriverId('');
      setPreferredDrivers(null);
      return;
    }

    fetch('/api/drivers/preferred')
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json().catch(() => null)) as PreferredDriversResponse | null;
      })
      .then((data) => {
        if (data?.drivers?.length) {
          setPreferredDrivers(data);
          if (!preferredDriverId) setPreferredDriverId(data.drivers[0].id);
        }
      })
      .catch(() => null);
  }, [eligibleForPriority, planPerks.canLockPreferredDriver, preferredDriverId]);

  const refreshRouteEstimate = useCallback(async () => {
    if (!pickupAddress || !dropoffAddress) return;
    setRouteLoading(true);
    setQuote(null);
    try {
      const mins = await fetchRouteMinutes(pickupAddress, dropoffAddress);
      setTravelMinutes(mins);
    } catch (error) {
      setTravelMinutes(null);
      toast({
        title: 'Route estimate failed',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setRouteLoading(false);
    }
  }, [dropoffAddress, pickupAddress, toast]);

  useEffect(() => {
    if (!pickupAddress || !dropoffAddress) {
      setTravelMinutes(null);
      setQuote(null);
      return;
    }
    refreshRouteEstimate().catch(() => null);
  }, [dropoffAddress, pickupAddress, refreshRouteEstimate]);

  const scheduledStartIso = useMemo(() => {
    if (!scheduledStart) return null;
    const d = new Date(scheduledStart);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }, [scheduledStart]);

  const canQuote = Boolean(
    pickupAddress &&
      dropoffAddress &&
      travelMinutes &&
      scheduledStartIso &&
      (!eligibleForPriority || !lockToPreferred || preferredDriverId)
  );

  const advanceLabel = useMemo(() => {
    const pct = quote?.quote?.quoteBreakdown?.discount?.percentage ?? 0;
    if (pct >= 0.2) return "72+ hrs";
    if (pct >= 0.15) return "48 hrs";
    if (pct >= 0.1) return "24 hrs";
    return "Same-day";
  }, [quote?.quote?.quoteBreakdown?.discount?.percentage]);

  async function getQuote() {
    if (!canQuote || !scheduledStartIso || !travelMinutes) return;

    setQuoteLoading(true);
    setQuote(null);
    try {
      const res = await fetch('/api/delivery-requests/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType,
          scheduledStart: scheduledStartIso,
          travelMinutes,
          waitMinutes,
          sitAndWait,
          numberOfStops,
          returnOrExchange,
          cashHandling,
          peakHours,
          prioritySlot: eligibleForPriority ? prioritySlot : undefined,
          preferredDriverId: eligibleForPriority && lockToPreferred ? preferredDriverId : undefined,
          lockToPreferred: eligibleForPriority ? lockToPreferred : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<QuoteResponse> & { error?: unknown };
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Quote failed');
      }
      if (!data.quoteToken || !data.quote) throw new Error('Invalid quote response');
      setQuote(data as QuoteResponse);
    } catch (error) {
      toast({
        title: 'Quote unavailable',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setQuoteLoading(false);
    }
  }

  const milesShortfall = useMemo(() => {
    if (!wallet || !quote || wallet.unlimited) return 0;
    return Math.max(0, quote.quote.serviceMilesFinal - wallet.wallet.balanceMiles);
  }, [wallet, quote]);

  async function submit() {
    if (!pickupAddress || !dropoffAddress || !quote || !scheduledStartIso || !travelMinutes) return;
    const idempotencyKey = `sm_${crypto.randomUUID()}`;

    try {
      const res = await fetch('/api/delivery-requests/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType,
          pickupAddress: pickupAddress.formattedAddress,
          dropoffAddress: dropoffAddress.formattedAddress,
          notes: notes.trim() || undefined,
          scheduledStart: scheduledStartIso,
          travelMinutes,
          waitMinutes,
          sitAndWait,
          numberOfStops,
          returnOrExchange,
          cashHandling,
          peakHours,
          prioritySlot: eligibleForPriority ? prioritySlot : undefined,
          preferredDriverId: eligibleForPriority && lockToPreferred ? preferredDriverId : undefined,
          lockToPreferred: eligibleForPriority ? lockToPreferred : undefined,
          idempotencyKey,
          quoteToken: quote.quoteToken,
          paymentPreference: canChooseMonthlyPayments ? paymentPreference : 'INSTANT',
        }),
      });
      const data = (await res.json().catch(() => ({}))) as SubmitResponse & { error?: unknown };
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Submit failed');
      }
      if (!data.id) throw new Error('Missing request id');
      if (data.deliveryPaymentRequired) {
        toast({
          title: 'Payment required',
          description: 'Complete payment to unlock dispatch for this request.',
        });
        router.push(`/pay/${data.id}`);
        return;
      }
      if (data.paymentRequired) {
        if (!data.overageClientSecret || typeof data.overageCents !== 'number') {
          throw new Error('Overage payment is required but missing payment details');
        }
        setOveragePayment({
          requestId: data.id,
          amountCents: data.overageCents,
          clientSecret: data.overageClientSecret,
        });
        toast({
          title: 'Overage payment required',
          description: `Please pay $${(data.overageCents / 100).toFixed(2)} to dispatch this request.`,
        });
        return;
      }
      toast({ title: 'Request submitted', description: 'Your Service Miles request is now queued.' });
      router.push(`/order/${data.id}`);
    } catch (error) {
      toast({
        title: 'Submit failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 sm:p-6 space-y-4">
        <div>
          <div className="text-sm font-semibold">Wallet</div>
          {walletLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : wallet ? (
            <div className="text-sm text-muted-foreground">
              Balance:{' '}
              <span className="text-foreground font-medium">
                {wallet.unlimited ? 'Unlimited' : wallet.wallet.balanceMiles.toLocaleString()}
              </span>
              {wallet.plan?.name ? (
                <span className="ml-2">({wallet.plan.name})</span>
              ) : null}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Unavailable</div>
          )}
        </div>
      </Card>

      <Card className="p-5 sm:p-6 space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pickup</div>
            <AddressSearch
              ariaLabel="Pickup address"
              enableCurrentLocation
              onSelect={(addr) => {
                setPickupAddress(addr);
                setQuote(null);
              }}
            />
            {pickupLines && (
              <div className="text-xs text-muted-foreground">
                {pickupLines.primary}
                {pickupLines.secondary ? `, ${pickupLines.secondary}` : ''}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Dropoff</div>
            <AddressSearch
              ariaLabel="Dropoff address"
              enableCurrentLocation
              onSelect={(addr) => {
                setDropoffAddress(addr);
                setQuote(null);
              }}
            />
            {dropoffLines && (
              <div className="text-xs text-muted-foreground">
                {dropoffLines.primary}
                {dropoffLines.secondary ? `, ${dropoffLines.secondary}` : ''}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Service Type</div>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={serviceType}
              onChange={(e) => {
                setServiceType(e.target.value as ServiceType);
                setQuote(null);
              }}
            >
              {Object.values(ServiceType).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Scheduled Start</div>
            <Input
              type="datetime-local"
              value={scheduledStart}
              onChange={(e) => {
                setScheduledStart(e.target.value);
                setQuote(null);
              }}
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Travel Minutes</div>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                value={travelMinutes ?? ''}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setTravelMinutes(Number.isFinite(n) ? Math.max(1, Math.floor(n)) : null);
                  setQuote(null);
                }}
                placeholder={routeLoading ? 'Calculating…' : 'Minutes'}
              />
              <Button type="button" variant="outline" onClick={refreshRouteEstimate} disabled={!pickupAddress || !dropoffAddress || routeLoading}>
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Wait Minutes</div>
            <Input
              type="number"
              min={0}
              value={waitMinutes}
              onChange={(e) => {
                setWaitMinutes(Math.max(0, Math.floor(Number(e.target.value) || 0)));
                setQuote(null);
              }}
            />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Sit-and-Wait</div>
            <label className="inline-flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-background text-sm">
              <input
                type="checkbox"
                checked={sitAndWait}
                onChange={(e) => {
                  setSitAndWait(e.target.checked);
                  setQuote(null);
                }}
                disabled={!planPerks.canUseSitAndWait}
              />
              Premium wait rate
            </label>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Stops</div>
            <Input
              type="number"
              min={1}
              value={numberOfStops}
              onChange={(e) => {
                setNumberOfStops(Math.max(1, Math.floor(Number(e.target.value) || 1)));
                setQuote(null);
              }}
              disabled={!planPerks.canUseMultiStop}
            />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Notes</div>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[40px]" />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={returnOrExchange}
              onChange={(e) => {
                setReturnOrExchange(e.target.checked);
                setQuote(null);
              }}
              disabled={!planPerks.canUseReturnOrExchange}
            />
            Return/Exchange
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={cashHandling}
              onChange={(e) => {
                setCashHandling(e.target.checked);
                setQuote(null);
              }}
              disabled={!planPerks.canUseCashHandling}
            />
            Cash handling
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={peakHours}
              onChange={(e) => {
                setPeakHours(e.target.checked);
                setQuote(null);
              }}
            />
            Peak hours
          </label>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Payment Timing</div>
          {canChooseMonthlyPayments ? (
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={paymentPreference}
              onChange={(event) => setPaymentPreference(event.target.value as PaymentPreference)}
            >
              <option value="INSTANT">Pay instantly (required before dispatch)</option>
              <option value="MONTHLY">Monthly billing (use service miles first)</option>
            </select>
          ) : (
            <div className="text-sm text-muted-foreground">
              Your current plan uses Service Miles first and requires instant settlement when miles run out.
            </div>
          )}
        </div>

        {eligibleForPriority ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Priority Slot</div>
              <label className="inline-flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-background text-sm">
                <input
                  type="checkbox"
                  checked={prioritySlot}
                  onChange={(e) => {
                    setPrioritySlot(e.target.checked);
                    setQuote(null);
                  }}
                />
                Priority time-slot booking
              </label>
            </div>
            {planPerks.canLockPreferredDriver ? (
              <>
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Locked Driver</div>
                  <label className="inline-flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-background text-sm">
                    <input
                      type="checkbox"
                      checked={lockToPreferred}
                      onChange={(e) => {
                        setLockToPreferred(e.target.checked);
                        setQuote(null);
                      }}
                    />
                    Locked driver when possible
                  </label>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Preferred Driver</div>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={preferredDriverId}
                    onChange={(e) => {
                      setPreferredDriverId(e.target.value);
                      setQuote(null);
                    }}
                    disabled={!lockToPreferred || !preferredDrivers?.drivers?.length}
                  >
                    {preferredDrivers?.drivers?.length
                      ? preferredDrivers.drivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))
                      : null}
                  </select>
                </div>
              </>
            ) : (
              <div className="col-span-2 rounded-md border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                Locked preferred-driver routing unlocks on higher tiers.
              </div>
            )}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={getQuote} disabled={!canQuote || quoteLoading}>
            {quoteLoading ? 'Quoting…' : 'Get Service Miles Quote'}
          </Button>
          {quote ? (
            <>
              <Button type="button" variant="outline" onClick={submit} disabled={!quote}>
                Accept
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setQuote(null)}
                disabled={quoteLoading}
              >
                Decline
              </Button>
            </>
          ) : null}
          {!wallet?.unlimited && quote && milesShortfall > 0 ? (
            <div className="text-sm text-amber-500 self-center">
              {wallet?.wallet.balanceMiles ?? 0} miles available. {milesShortfall} overage miles will be billed.
            </div>
          ) : null}
        </div>
      </Card>

      {overagePayment ? (
        <Card className="p-5 sm:p-6 space-y-3">
          <div className="text-sm font-semibold">Complete Overage Payment</div>
          <div className="text-sm text-muted-foreground">
            Pay ${ (overagePayment.amountCents / 100).toFixed(2) } to unlock dispatch.
          </div>
          <StripePaymentForm
            amountCents={overagePayment.amountCents}
            initialClientSecret={overagePayment.clientSecret}
            onSuccess={() => router.push(`/order/${overagePayment.requestId}`)}
            onError={(error) =>
              toast({
                title: 'Overage payment failed',
                description: error,
                variant: 'destructive',
              })
            }
          />
        </Card>
      ) : null}

      {quote ? (
        <Card className="p-5 sm:p-6 space-y-2">
          <div className="text-sm font-semibold">Quote</div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Service Cost</span>
              <span className="text-foreground font-medium">{quote.quote.quoteBreakdown.subtotal} Service Miles</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                Advance Booking Discount
                {` (${advanceLabel})`}
              </span>
              <span className="text-foreground font-medium">-{quote.quote.quoteBreakdown.discount.amount} Miles</span>
            </div>
            <div className="flex items-center justify-between border-t border-border/60 pt-2">
              <span className="text-muted-foreground">Final Cost</span>
              <span className="text-foreground font-semibold">{quote.quote.serviceMilesFinal} Service Miles</span>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
