'use client';

import { useEffect, useMemo, useState } from 'react';
import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwStatPill from '@/components/ui/otw/OtwStatPill';

type SummaryResponse = {
  totals: {
    leads: number;
    events: number;
  };
  leadsByInterestType: Record<string, number>;
  leadsByServiceType: Record<string, number>;
  eventsByEventType: Record<string, number>;
  serviceDemand: {
    serviceViewsByServiceType: Record<string, number>;
    serviceSelectedByServiceType: Record<string, number>;
    leadsByServiceType: Record<string, number>;
  };
  funnels: {
    request: {
      requestStarts: number;
      requestSubmissions: number;
      abandonedSignals: number;
      loginRequiredCount: number;
    };
    membership: {
      membershipViews: number;
      membershipSelections: number;
      membershipCheckoutStarts: number;
      membershipCheckoutCompleted: number;
    };
    driver: {
      driverApplicationStarts: number;
      driverApplicationSubmissions: number;
    };
  };
  recent: {
    leads: Array<{
      id: string;
      createdAt: string;
      interestType: string;
      serviceType: string | null;
      name: string | null;
      email: string | null;
      phone: string | null;
      sourcePage: string | null;
      message: string | null;
    }>;
    events: Array<{
      id: string;
      createdAt: string;
      sessionId: string;
      eventType: string;
      page: string | null;
      serviceType: string | null;
      userId: string | null;
    }>;
  };
};

function safeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function ratio(numerator: number, denominator: number): string {
  if (denominator <= 0) return '0%';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function sortCountEntries(map: Record<string, number>) {
  return Object.entries(map ?? {}).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
}

function shortSession(sessionId: string) {
  if (!sessionId) return '';
  return sessionId.length <= 10 ? sessionId : `${sessionId.slice(0, 6)}…${sessionId.slice(-4)}`;
}

export default function AdminOtwAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);

  useEffect(() => {
    let active = true;

    fetch('/api/admin/otw/analytics/summary', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
      },
    })
      .then(async (res) => {
        const payload = (await res.json().catch(() => null)) as SummaryResponse | { error?: string } | null;
        if (!res.ok) {
          const message =
            payload && 'error' in payload && typeof payload.error === 'string'
              ? payload.error
              : `Request failed (${res.status})`;
          throw new Error(message);
        }
        return payload as SummaryResponse;
      })
      .then((data) => {
        if (!active) return;
        setSummary(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load analytics.');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const conversionSnapshot = useMemo(() => {
    const leads = summary?.leadsByInterestType ?? {};
    const get = (key: string) => safeNumber(leads[key]);
    return {
      total: safeNumber(summary?.totals?.leads),
      serviceRequest: get('SERVICE_REQUEST'),
      membershipInterest: get('MEMBERSHIP_INTEREST'),
      driverInterest: get('DRIVER_INTEREST'),
      businessAccount: get('BUSINESS_ACCOUNT'),
      generalContact: get('GENERAL_CONTACT'),
      launchList: get('LAUNCH_LIST'),
    };
  }, [summary]);

  const requestFunnel = summary?.funnels?.request;
  const membershipFunnel = summary?.funnels?.membership;
  const driverFunnel = summary?.funnels?.driver;

  return (
    <OtwPageShell>
      <OtwSectionHeader title="OTW Analytics" subtitle="Leads + on-site intent events (Phase 1)." />

      {loading ? (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <OtwCard key={i} className="p-5 sm:p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-3 w-1/3 rounded bg-white/10" />
                <div className="h-7 w-1/2 rounded bg-white/5" />
                <div className="h-3 w-2/3 rounded bg-white/10" />
              </div>
            </OtwCard>
          ))}
        </div>
      ) : null}

      {error ? (
        <OtwCard className="mt-4 border border-red-500/30 bg-red-500/10 p-5 sm:p-6">
          <div className="text-sm font-semibold text-red-200">Unable to load analytics</div>
          <div className="mt-1 text-xs text-red-100/80">{error}</div>
        </OtwCard>
      ) : null}

      {summary && !loading && !error ? (
        <div className="mt-4 space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <OtwCard className="p-5 sm:p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">Totals</div>
              <div className="mt-3 space-y-2">
                <OtwStatPill label="Leads" value={String(summary.totals.leads)} tone="gold" />
                <OtwStatPill label="Events" value={String(summary.totals.events)} tone="neutral" />
              </div>
            </OtwCard>

            <OtwCard className="p-5 sm:p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">Request Funnel</div>
              <div className="mt-3 space-y-2">
                <OtwStatPill label="Starts" value={String(requestFunnel?.requestStarts ?? 0)} tone="neutral" />
                <OtwStatPill label="Submits" value={String(requestFunnel?.requestSubmissions ?? 0)} tone="success" />
                <div className="text-xs text-white/55">
                  Start to submit: {ratio(requestFunnel?.requestSubmissions ?? 0, requestFunnel?.requestStarts ?? 0)}
                </div>
              </div>
            </OtwCard>

            <OtwCard className="p-5 sm:p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">Membership Funnel</div>
              <div className="mt-3 space-y-2">
                <OtwStatPill label="Views" value={String(membershipFunnel?.membershipViews ?? 0)} tone="neutral" />
                <OtwStatPill
                  label="Checkout Starts"
                  value={String(membershipFunnel?.membershipCheckoutStarts ?? 0)}
                  tone="gold"
                />
                <OtwStatPill
                  label="Completed"
                  value={String(membershipFunnel?.membershipCheckoutCompleted ?? 0)}
                  tone="success"
                />
              </div>
            </OtwCard>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <OtwCard className="p-5 sm:p-6">
              <div className="text-sm font-semibold">Conversion Snapshot</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <OtwStatPill label="Total leads" value={String(conversionSnapshot.total)} tone="gold" />
                <OtwStatPill label="Service request" value={String(conversionSnapshot.serviceRequest)} tone="neutral" />
                <OtwStatPill
                  label="Membership interest"
                  value={String(conversionSnapshot.membershipInterest)}
                  tone="neutral"
                />
                <OtwStatPill label="Driver interest" value={String(conversionSnapshot.driverInterest)} tone="neutral" />
                <OtwStatPill
                  label="Business accounts"
                  value={String(conversionSnapshot.businessAccount)}
                  tone="neutral"
                />
                <OtwStatPill label="General contact" value={String(conversionSnapshot.generalContact)} tone="neutral" />
                <OtwStatPill label="Launch list" value={String(conversionSnapshot.launchList)} tone="neutral" />
              </div>
            </OtwCard>

            <OtwCard className="p-5 sm:p-6">
              <div className="text-sm font-semibold">Friction Signals</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <OtwStatPill
                  label="Login required"
                  value={String(requestFunnel?.loginRequiredCount ?? 0)}
                  tone="neutral"
                />
                <OtwStatPill
                  label="Abandoned signals"
                  value={String(requestFunnel?.abandonedSignals ?? 0)}
                  tone="neutral"
                />
                <OtwStatPill
                  label="Driver starts"
                  value={String(driverFunnel?.driverApplicationStarts ?? 0)}
                  tone="neutral"
                />
                <OtwStatPill
                  label="Driver submits"
                  value={String(driverFunnel?.driverApplicationSubmissions ?? 0)}
                  tone="success"
                />
              </div>
            </OtwCard>
          </div>

          <OtwCard className="p-5 sm:p-6">
            <div className="text-sm font-semibold">Service Demand</div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-[640px] w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-white/50">
                    <th className="py-2 pr-4">Service</th>
                    <th className="py-2 pr-4">Views</th>
                    <th className="py-2 pr-4">Selected</th>
                    <th className="py-2 pr-4">Leads</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {Array.from(
                    new Set([
                      ...Object.keys(summary.serviceDemand.serviceViewsByServiceType ?? {}),
                      ...Object.keys(summary.serviceDemand.serviceSelectedByServiceType ?? {}),
                      ...Object.keys(summary.serviceDemand.leadsByServiceType ?? {}),
                    ]),
                  )
                    .sort()
                    .map((key) => (
                      <tr key={key} className="text-white/85">
                        <td className="py-2 pr-4 font-medium">{key}</td>
                        <td className="py-2 pr-4">{summary.serviceDemand.serviceViewsByServiceType[key] ?? 0}</td>
                        <td className="py-2 pr-4">{summary.serviceDemand.serviceSelectedByServiceType[key] ?? 0}</td>
                        <td className="py-2 pr-4">{summary.serviceDemand.leadsByServiceType[key] ?? 0}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </OtwCard>

          <div className="grid gap-4 md:grid-cols-2">
            <OtwCard className="p-5 sm:p-6">
              <div className="text-sm font-semibold">Recent Leads</div>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-[720px] w-full text-xs">
                  <thead>
                    <tr className="text-left uppercase tracking-wide text-white/50">
                      <th className="py-2 pr-4">Created</th>
                      <th className="py-2 pr-4">Interest</th>
                      <th className="py-2 pr-4">Service</th>
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Phone</th>
                      <th className="py-2 pr-4">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {summary.recent.leads.map((lead) => (
                      <tr key={lead.id} className="text-white/80">
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {new Date(lead.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap">{lead.interestType}</td>
                        <td className="py-2 pr-4 whitespace-nowrap">{lead.serviceType ?? '-'}</td>
                        <td className="py-2 pr-4 whitespace-nowrap">{lead.name ?? '-'}</td>
                        <td className="py-2 pr-4 whitespace-nowrap">{lead.email ?? '-'}</td>
                        <td className="py-2 pr-4 whitespace-nowrap">{lead.phone ?? '-'}</td>
                        <td className="py-2 pr-4 whitespace-nowrap">{lead.sourcePage ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </OtwCard>

            <OtwCard className="p-5 sm:p-6">
              <div className="text-sm font-semibold">Recent Events</div>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-[720px] w-full text-xs">
                  <thead>
                    <tr className="text-left uppercase tracking-wide text-white/50">
                      <th className="py-2 pr-4">Created</th>
                      <th className="py-2 pr-4">Event</th>
                      <th className="py-2 pr-4">Service</th>
                      <th className="py-2 pr-4">Page</th>
                      <th className="py-2 pr-4">Session</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {summary.recent.events.map((event) => (
                      <tr key={event.id} className="text-white/80">
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {new Date(event.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap">{event.eventType}</td>
                        <td className="py-2 pr-4 whitespace-nowrap">{event.serviceType ?? '-'}</td>
                        <td className="py-2 pr-4 whitespace-nowrap">{event.page ?? '-'}</td>
                        <td className="py-2 pr-4 whitespace-nowrap">{shortSession(event.sessionId)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </OtwCard>
          </div>

          <OtwCard className="p-5 sm:p-6">
            <div className="text-sm font-semibold">Events By Type</div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {sortCountEntries(summary.eventsByEventType).map(([key, count]) => (
                <OtwStatPill key={key} label={key} value={String(count)} tone="neutral" />
              ))}
            </div>
          </OtwCard>
        </div>
      ) : null}
    </OtwPageShell>
  );
}
