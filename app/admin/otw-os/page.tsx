import OtwPageShell from "@/components/ui/otw/OtwPageShell";
import OtwSectionHeader from "@/components/ui/otw/OtwSectionHeader";
import OtwCard from "@/components/ui/otw/OtwCard";
import { requireRole } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { calculateDriverPayCents } from "@/lib/driver-pay";
import { DeliveryRequestStatus } from "@prisma/client";

function formatUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function safeCents(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.trunc(value);
}

function startOfCurrentWeek(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export default async function AdminOtwOsPage() {
  await requireRole(["ADMIN"]);
  const prisma = getPrisma();

  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - 30);
  const startOfWeek = startOfCurrentWeek(now);

  const [requests, profiles, ordersPlacedThisWeek] = await Promise.all([
    prisma.deliveryRequest.findMany({
      where: { status: DeliveryRequestStatus.DELIVERED, completedAt: { gte: since } },
      select: {
        id: true,
        serviceType: true,
        serviceMilesFinal: true,
        complaintFlag: true,
        customerRating: true,
        tipCents: true,
        deliveryFeeCents: true,
        overageCents: true,
        discountCents: true,
        estimatedMinutes: true,
        completedAt: true,
        assignedDriverId: true,
        assignedDriver: {
          select: {
            id: true,
            userId: true,
            tierLevel: true,
            hourlyRateCents: true,
            bonusEnabled: true,
            bonus5StarCents: true,
          },
        },
        timeLogs: {
          where: { endTime: { not: null } },
          select: { activeMinutes: true },
        },
      },
    }),
    prisma.driverProfile.findMany({
      select: {
        id: true,
        userId: true,
        tierLevel: true,
        hourlyRateCents: true,
        performanceMetrics: true,
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.deliveryRequest.count({
      where: {
        createdAt: { gte: startOfWeek },
        status: { not: DeliveryRequestStatus.DRAFT },
      },
    }),
  ]);

  const driverProfileByUserId = new Map(profiles.map((p) => [p.userId, p]));
  const totalMiles = requests.reduce((sum, r) => sum + (r.serviceMilesFinal ?? 0), 0);
  const totalTipsCents = requests.reduce((sum, r) => sum + safeCents(r.tipCents), 0);

  let totalCompCents = 0;
  let ordersCompletedThisWeek = 0;
  let weeklyTipsCents = 0;
  let weeklyRevenueCents = 0;
  let weeklyCompCents = 0;
  const requestCompCentsById = new Map<string, number>();
  const activeMinutesByUserId = new Map<string, number>();

  for (const request of requests) {
    const activeMinutes = request.timeLogs.reduce((sum, log) => {
      return sum + Math.max(0, Math.trunc(log.activeMinutes));
    }, 0);

    const revenueCents = Math.max(
      0,
      safeCents(request.deliveryFeeCents) + safeCents(request.overageCents) - safeCents(request.discountCents)
    );

    let compCents = 0;
    if (request.assignedDriver) {
      const estimatedMinutes = typeof request.estimatedMinutes === "number"
        ? Math.max(0, Math.trunc(request.estimatedMinutes))
        : 0;
      const onTimeEligible = estimatedMinutes > 0 ? activeMinutes <= estimatedMinutes + 10 : false;
      const earlyEligible = estimatedMinutes > 0 ? activeMinutes <= Math.max(1, estimatedMinutes - 5) : false;
      const pay = calculateDriverPayCents({
        driverTier: request.assignedDriver.tierLevel,
        activeMinutes,
        tipsCents: safeCents(request.tipCents),
        serviceMiles: request.serviceMilesFinal ?? 0,
        deliveryFeeCents: request.deliveryFeeCents ?? undefined,
        bonusEligible:
          request.customerRating === 5 &&
          !request.complaintFlag &&
          request.assignedDriver.bonusEnabled,
        hourlyRateCents:
          request.assignedDriver.hourlyRateCents > 0
            ? request.assignedDriver.hourlyRateCents
            : undefined,
        bonus5StarCents:
          request.assignedDriver.bonus5StarCents > 0
            ? request.assignedDriver.bonus5StarCents
            : undefined,
        onTimeEligible,
        earlyEligible,
      });
      compCents = Math.max(0, pay.totalPayCents - pay.tipsCents);
      activeMinutesByUserId.set(
        request.assignedDriver.userId,
        (activeMinutesByUserId.get(request.assignedDriver.userId) ?? 0) + activeMinutes
      );
    } else {
      compCents = Math.max(0, Math.round(safeCents(request.deliveryFeeCents) * 0.5));
    }

    requestCompCentsById.set(request.id, compCents);
    totalCompCents += compCents;

    if (request.completedAt && request.completedAt >= startOfWeek) {
      ordersCompletedThisWeek += 1;
      weeklyTipsCents += safeCents(request.tipCents);
      weeklyRevenueCents += revenueCents;
      weeklyCompCents += compCents;
    }
  }

  const weeklyProfitCents = weeklyRevenueCents - weeklyCompCents;
  const weeklyCompletionRate =
    ordersPlacedThisWeek > 0 ? ordersCompletedThisWeek / ordersPlacedThisWeek : 0;

  const totalActiveMinutes = Array.from(activeMinutesByUserId.values()).reduce((a, b) => a + b, 0);
  const totalActiveHours = totalActiveMinutes / 60;

  let hourlyBaseEstimateCents = 0;
  for (const [userId, minutes] of activeMinutesByUserId.entries()) {
    const profile = driverProfileByUserId.get(userId);
    if (!profile) continue;
    const hourlyRate = Math.max(0, Math.trunc(profile.hourlyRateCents ?? 0));
    hourlyBaseEstimateCents += Math.ceil((minutes * hourlyRate) / 60);
  }
  const bonusLeakageCents = Math.max(0, totalCompCents - hourlyBaseEstimateCents);

  const costPerMileCents = totalMiles > 0 ? Math.round(totalCompCents / totalMiles) : 0;
  const paidPerHourCents = totalActiveHours > 0 ? Math.round(totalCompCents / totalActiveHours) : 0;

  const avgTipCents = requests.length > 0 ? Math.round(totalTipsCents / requests.length) : 0;

  const serviceStats = new Map<
    string,
    { miles: number; compCents: number; tipsCents: number; jobs: number; complaints: number; fiveStars: number }
  >();

  for (const r of requests) {
    const key = String(r.serviceType);
    const cur = serviceStats.get(key) ?? {
      miles: 0,
      compCents: 0,
      tipsCents: 0,
      jobs: 0,
      complaints: 0,
      fiveStars: 0,
    };
    cur.miles += r.serviceMilesFinal ?? 0;
    cur.compCents += requestCompCentsById.get(r.id) ?? 0;
    cur.tipsCents += safeCents(r.tipCents);
    cur.jobs += 1;
    cur.complaints += r.complaintFlag ? 1 : 0;
    cur.fiveStars += r.customerRating === 5 ? 1 : 0;
    serviceStats.set(key, cur);
  }

  const serviceRows = Array.from(serviceStats.entries())
    .map(([serviceType, s]) => {
      const costPerMile = s.miles > 0 ? Math.round(s.compCents / s.miles) : 0;
      const complaintRate = s.jobs > 0 ? s.complaints / s.jobs : 0;
      const fiveStarRate = s.jobs > 0 ? s.fiveStars / s.jobs : 0;
      return {
        serviceType,
        ...s,
        costPerMile,
        complaintRate,
        fiveStarRate,
      };
    })
    .sort((a, b) => b.costPerMile - a.costPerMile)
    .slice(0, 10);

  const driverRows = profiles
    .map((p) => {
      const m = (p.performanceMetrics ?? {}) as Record<string, unknown>;
      const score = typeof m.performanceScore === "number" ? m.performanceScore : 0;
      const avgRating = typeof m.avgRatingRolling === "number" ? m.avgRatingRolling : 0;
      const onTimeRate = typeof m.onTimeRateRolling === "number" ? m.onTimeRateRolling : 0;
      return {
        id: p.id,
        userId: p.userId,
        name: p.user?.name || p.user?.email || p.userId,
        tier: p.tierLevel,
        score,
        avgRating,
        onTimeRate,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return (
    <OtwPageShell>
      <OtwSectionHeader
        title="OTW-OS"
        subtitle="Economy metrics for the last 30 days with a live weekly snapshot."
      />

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <OtwCard className="p-5 sm:p-6">
          <div className="text-sm font-medium">Orders Placed (This Week)</div>
          <div className="mt-2 text-2xl font-semibold">{ordersPlacedThisWeek.toLocaleString()}</div>
          <div className="mt-1 text-xs text-white/60">Submitted requests (excludes drafts)</div>
        </OtwCard>
        <OtwCard className="p-5 sm:p-6">
          <div className="text-sm font-medium">Orders Completed (This Week)</div>
          <div className="mt-2 text-2xl font-semibold">{ordersCompletedThisWeek.toLocaleString()}</div>
          <div className="mt-1 text-xs text-white/60">
            {Math.round(weeklyCompletionRate * 100)}% completion vs placed this week
          </div>
        </OtwCard>
        <OtwCard className="p-5 sm:p-6">
          <div className="text-sm font-medium">Profit (This Week)</div>
          <div className={`mt-2 text-2xl font-semibold ${weeklyProfitCents >= 0 ? "text-green-400" : "text-red-400"}`}>
            {formatUsd(weeklyProfitCents)}
          </div>
          <div className="mt-1 text-xs text-white/60">Revenue minus driver cost (tips excluded)</div>
        </OtwCard>
        <OtwCard className="p-5 sm:p-6">
          <div className="text-sm font-medium">Revenue (This Week)</div>
          <div className="mt-2 text-2xl font-semibold">{formatUsd(weeklyRevenueCents)}</div>
          <div className="mt-1 text-xs text-white/60">Delivery fees + overages - discounts</div>
        </OtwCard>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <OtwCard className="p-5 sm:p-6">
          <div className="text-sm font-medium">Delivery Units</div>
          <div className="mt-2 text-2xl font-semibold">{totalMiles.toLocaleString()}</div>
          <div className="mt-1 text-xs text-white/60">Delivered requests only</div>
        </OtwCard>
        <OtwCard className="p-5 sm:p-6">
          <div className="text-sm font-medium">Driver Cost</div>
          <div className="mt-2 text-2xl font-semibold">{formatUsd(totalCompCents)}</div>
          <div className="mt-1 text-xs text-white/60">Excludes tips</div>
        </OtwCard>
        <OtwCard className="p-5 sm:p-6">
          <div className="text-sm font-medium">Efficiency Index</div>
          <div className="mt-2 text-2xl font-semibold">{formatUsd(costPerMileCents)}</div>
          <div className="mt-1 text-xs text-white/60">Delivered requests only</div>
        </OtwCard>
        <OtwCard className="p-5 sm:p-6">
          <div className="text-sm font-medium">Cost / Driver Hour</div>
          <div className="mt-2 text-2xl font-semibold">{formatUsd(paidPerHourCents)}</div>
          <div className="mt-1 text-xs text-white/60">{totalActiveHours.toFixed(1)} active hrs</div>
        </OtwCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <OtwCard className="p-5 sm:p-6">
          <div className="text-sm font-medium">Tips</div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-white/70">Collected</span>
            <span className="font-semibold">{formatUsd(totalTipsCents)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-white/70">This Week</span>
            <span className="font-semibold">{formatUsd(weeklyTipsCents)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-white/70">Avg / delivered order</span>
            <span className="font-semibold">{formatUsd(avgTipCents)}</span>
          </div>
          <div className="mt-3 text-xs text-white/60">
            Last 30 days of delivered requests. Tips remain excluded from OTW driver cost.
          </div>
        </OtwCard>

        <OtwCard className="p-5 sm:p-6 lg:col-span-2">
          <div className="text-sm font-medium">Bonus Review</div>
          <div className="mt-2 flex items-center justify-between">
            <div className="text-xs text-white/60">Driver incentives review</div>
            <div className="text-sm font-semibold">{formatUsd(bonusLeakageCents)}</div>
          </div>
          <div className="mt-2 text-xs text-white/60">
            Uses active request logs and current driver rates.
          </div>
        </OtwCard>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <OtwCard className="p-5 sm:p-6">
          <div className="text-sm font-medium">Most Expensive Services</div>
          <div className="mt-3 space-y-2 text-sm">
            {serviceRows.length ? (
              serviceRows.map((r) => (
                <div key={r.serviceType} className="flex items-center justify-between border-b border-white/10 py-2 last:border-0">
                  <div>
                    <div className="font-semibold">{r.serviceType}</div>
                    <div className="text-xs text-white/60">
                      {r.jobs} jobs • {(r.complaintRate * 100).toFixed(0)}% complaints
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatUsd(r.costPerMile)}</div>
                    <div className="text-xs text-white/60">index</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-white/60">No delivered requests in range.</div>
            )}
          </div>
        </OtwCard>

        <OtwCard className="p-5 sm:p-6">
          <div className="text-sm font-medium">Best Drivers (Scorecard)</div>
          <div className="mt-3 space-y-2 text-sm">
            {driverRows.length ? (
              driverRows.map((d) => (
                <div key={d.id} className="flex items-center justify-between border-b border-white/10 py-2 last:border-0">
                  <div>
                    <div className="font-semibold">{d.name}</div>
                    <div className="text-xs text-white/60">
                      {d.tier} • {d.avgRating.toFixed(2)} rating • {(d.onTimeRate * 100).toFixed(0)}% on-time
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{Math.round(d.score)}</div>
                    <div className="text-xs text-white/60">score</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-white/60">No drivers found.</div>
            )}
          </div>
        </OtwCard>
      </div>
    </OtwPageShell>
  );
}
