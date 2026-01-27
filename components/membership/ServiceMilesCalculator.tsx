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
import { formatAddressLines, type GeocodedAddress } from '@/lib/geocoding';

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
  plan: { name: string; cashAllowed: boolean } | null;
  wallet: { balanceMiles: number; rolloverBankMiles: number };
  unlimited: boolean;
};

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

  const canQuote = Boolean(pickupAddress && dropoffAddress && travelMinutes && scheduledStartIso);

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

  const hasEnoughMiles = useMemo(() => {
    if (!wallet || !quote) return false;
    if (wallet.unlimited) return true;
    return wallet.wallet.balanceMiles >= quote.quote.serviceMilesFinal;
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
          idempotencyKey,
          quoteToken: quote.quoteToken,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: unknown };
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Submit failed');
      }
      if (!data.id) throw new Error('Missing request id');
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
              disabled={wallet?.plan ? !wallet.plan.cashAllowed : false}
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

        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={getQuote} disabled={!canQuote || quoteLoading}>
            {quoteLoading ? 'Quoting…' : 'Get Service Miles Quote'}
          </Button>
          <Button type="button" variant="outline" onClick={submit} disabled={!quote || !hasEnoughMiles}>
            Submit Request
          </Button>
          {!wallet?.unlimited && quote && !hasEnoughMiles ? (
            <div className="text-sm text-red-500 self-center">
              Not enough Service Miles.
            </div>
          ) : null}
        </div>
      </Card>

      {quote ? (
        <Card className="p-5 sm:p-6 space-y-2">
          <div className="text-sm font-semibold">Quote</div>
          <div className="text-sm text-muted-foreground">
            Required: <span className="text-foreground font-medium">{quote.quote.serviceMilesFinal}</span> Service Miles
          </div>
          <div className="text-xs text-muted-foreground">
            Base {quote.quote.quoteBreakdown.baseMiles} • Wait {quote.quote.quoteBreakdown.adders.waitTime} • Sit-and-wait {quote.quote.quoteBreakdown.adders.sitAndWaitPremium} • Stops {quote.quote.quoteBreakdown.adders.multiStop} • Return {quote.quote.quoteBreakdown.adders.returnExchange} • Cash {quote.quote.quoteBreakdown.adders.cashHandling} • Peak {quote.quote.quoteBreakdown.adders.peakHours} • Discount {quote.quote.quoteBreakdown.discount.amount}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
