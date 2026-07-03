export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';

function readAllCount(row: { _count: unknown }): number {
  const count = row._count as { _all?: number } | true | null | undefined;
  if (!count || count === true) return 0;
  return typeof count._all === 'number' ? count._all : 0;
}

function toCountMap<T extends string>(rows: Array<{ key: T | null; count: number }>) {
  const out: Partial<Record<T, number>> = {};
  for (const row of rows) {
    if (!row.key) continue;
    out[row.key] = row.count;
  }
  return out;
}

export async function GET() {
  try {
    await requireRole(['ADMIN']);
  } catch (_error) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const prisma = getPrisma();

  const [
    totalLeads,
    leadsByInterestTypeRows,
    leadsByServiceTypeRows,
    totalEvents,
    eventsByEventTypeRows,
    serviceViewsByServiceTypeRows,
    serviceSelectedByServiceTypeRows,
    requestStarts,
    requestSubmissions,
    requestAbandonedSignals,
    membershipViews,
    membershipSelections,
    membershipCheckoutStarts,
    membershipCheckoutCompleted,
    driverApplicationStarts,
    driverApplicationSubmissions,
    loginRequiredCount,
    recentLeads,
    recentEvents,
  ] = await Promise.all([
    prisma.otwLead.count(),
    prisma.otwLead.groupBy({
      by: ['interestType'],
      _count: { _all: true },
    } as const),
    prisma.otwLead.groupBy({
      by: ['serviceType'],
      _count: { _all: true },
    } as const),
    prisma.otwSiteEvent.count(),
    prisma.otwSiteEvent.groupBy({
      by: ['eventType'],
      _count: { _all: true },
    } as const),
    prisma.otwSiteEvent.groupBy({
      by: ['serviceType'],
      where: { eventType: 'SERVICE_VIEW' },
      _count: { _all: true },
    } as const),
    prisma.otwSiteEvent.groupBy({
      by: ['serviceType'],
      where: { eventType: 'SERVICE_SELECTED' },
      _count: { _all: true },
    } as const),
    prisma.otwSiteEvent.count({ where: { eventType: 'REQUEST_STARTED' } }),
    prisma.otwSiteEvent.count({ where: { eventType: 'REQUEST_SUBMITTED' } }),
    prisma.otwSiteEvent.count({ where: { eventType: 'REQUEST_ABANDONED_SIGNAL' } }),
    prisma.otwSiteEvent.count({ where: { eventType: 'MEMBERSHIP_VIEW' } }),
    prisma.otwSiteEvent.count({ where: { eventType: 'MEMBERSHIP_SELECTED' } }),
    prisma.otwSiteEvent.count({ where: { eventType: 'MEMBERSHIP_CHECKOUT_STARTED' } }),
    prisma.otwSiteEvent.count({ where: { eventType: 'MEMBERSHIP_CHECKOUT_COMPLETED' } }),
    prisma.otwSiteEvent.count({ where: { eventType: 'DRIVER_APPLICATION_STARTED' } }),
    prisma.otwSiteEvent.count({ where: { eventType: 'DRIVER_APPLICATION_SUBMITTED' } }),
    prisma.otwSiteEvent.count({ where: { eventType: 'LOGIN_REQUIRED' } }),
    prisma.otwLead.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        interestType: true,
        serviceType: true,
        name: true,
        email: true,
        phone: true,
        sourcePage: true,
        message: true,
      },
    }),
    prisma.otwSiteEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        createdAt: true,
        sessionId: true,
        eventType: true,
        page: true,
        serviceType: true,
        userId: true,
      },
    }),
  ]);

  const leadsByInterestType = toCountMap(
    leadsByInterestTypeRows.map((row) => ({
      key: row.interestType,
      count: readAllCount(row),
    })),
  );
  const leadsByServiceType = toCountMap(
    leadsByServiceTypeRows.map((row) => ({
      key: row.serviceType,
      count: readAllCount(row),
    })),
  );
  const eventsByEventType = toCountMap(
    eventsByEventTypeRows.map((row) => ({
      key: row.eventType,
      count: readAllCount(row),
    })),
  );
  const serviceViewsByServiceType = toCountMap(
    serviceViewsByServiceTypeRows.map((row) => ({
      key: row.serviceType,
      count: readAllCount(row),
    })),
  );
  const serviceSelectedByServiceType = toCountMap(
    serviceSelectedByServiceTypeRows.map((row) => ({
      key: row.serviceType,
      count: readAllCount(row),
    })),
  );

  return NextResponse.json({
    totals: {
      leads: totalLeads,
      events: totalEvents,
    },
    leadsByInterestType,
    leadsByServiceType,
    eventsByEventType,
    serviceDemand: {
      serviceViewsByServiceType,
      serviceSelectedByServiceType,
      leadsByServiceType,
    },
    funnels: {
      request: {
        requestStarts,
        requestSubmissions,
        abandonedSignals: requestAbandonedSignals,
        loginRequiredCount,
      },
      membership: {
        membershipViews,
        membershipSelections,
        membershipCheckoutStarts,
        membershipCheckoutCompleted,
      },
      driver: {
        driverApplicationStarts,
        driverApplicationSubmissions,
      },
    },
    recent: {
      leads: recentLeads,
      events: recentEvents,
    },
  });
}
