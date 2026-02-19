import OtwPageShell from "@/components/ui/otw/OtwPageShell";
import OtwSectionHeader from "@/components/ui/otw/OtwSectionHeader";
import OtwCard from "@/components/ui/otw/OtwCard";
import { requireRole } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { DeliveryRequestStatus } from "@prisma/client";

function formatUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function safeCents(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.trunc(value);
}

export default async function AdminOtwOsPage() {
  await requireRole(["ADMIN"]);
  const prisma = getPrisma();

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [requests, earnings, profiles, timeLogs] = await Promise.all([
    prisma.deliveryRequest.findMany({
      where: { status: DeliveryRequestStatus.DELIVERED, completedAt: { gte: since } },
      select: {
        id: true,
        serviceType: true,
        serviceMilesFinal: true,
        complaintFlag: true,
        customerRating: true,
        tipCents: true,
        assignedDriverId: true,
      },
    }),
    prisma.driverEarnings.findMany({
      where: { createdAt: { gte: since } },
      select: {
        id: true,
        driverId: true,
        status: true,
        amountCents: true,
        amount: true,
        tipCents: true,
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
    prisma.driverTimeLog.findMany({
      where: { endTime: { not: null }, createdAt: { gte: since } },
      select: { driverId: true, activeMinutes: true },
    }),
  ]);

  const requestById = new Map(requests.map((r) => [r.id, r]));

  const driverProfileByUserId = new Map(profiles.map((p) => [p.userId, p]));
  const userIdByDriverProfileId = new Map(profiles.map((p) => [p.id, p.userId]));

  const totalTipsCents = requests.reduce((sum, r) => sum + safeCents(r.tipCents), 0);

  const totalEarnedCents = earnings.reduce(
    (sum, e) => sum + safeCents(e.amountCents ?? e.amount),
    0
  );
  const totalTipEarningsCents = earnings.reduce((sum, e) => sum + safeCents(e.tipCents), 0);
  const totalCompCents = Math.max(0, totalEarnedCents - totalTipEarningsCents);

  const totalMiles = requests.reduce((sum, r) => sum + (r.serviceMilesFinal ?? 0), 0);

  const activeMinutesByUserId = new Map<string, number>();
  for (const log of timeLogs) {
    const userId = userIdByDriverProfileId.get(log.driverId);
    if (!userId) continue;
    activeMinutesByUserId.set(userId, (activeMinutesByUserId.get(userId) ?? 0) + Math.max(0, log.activeMinutes));
  }
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

  const tipsOwedCents = earnings
    .filter((e) => e.status === "pending" || e.status === "available")
    .reduce((sum, e) => sum + safeCents(e.tipCents), 0);
  const tipsPaidCents = earnings
    .filter((e) => e.status === "paid")
    .reduce((sum, e) => sum + safeCents(e.tipCents), 0);

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
        subtitle="Time-based economy metrics (last 30 days)."
      />

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <OtwCard className="p-5 sm:p-6">
          <div className="text-sm font-medium">Service Miles Charged</div>
          <div className="mt-2 text-2xl font-semibold">{totalMiles.toLocaleString()}</div>
          <div className="mt-1 text-xs text-white/60">Delivered requests only</div>
        </OtwCard>
        <OtwCard className="p-5 sm:p-6">
          <div className="text-sm font-medium">Driver Cost</div>
          <div className="mt-2 text-2xl font-semibold">{formatUsd(totalCompCents)}</div>
          <div className="mt-1 text-xs text-white/60">Excludes tips</div>
        </OtwCard>
        <OtwCard className="p-5 sm:p-6">
          <div className="text-sm font-medium">Cost / Service Mile</div>
          <div className="mt-2 text-2xl font-semibold">{formatUsd(costPerMileCents)}</div>
          <div className="mt-1 text-xs text-white/60">Driver cost ÷ miles</div>
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
            <span className="text-white/70">Owed</span>
            <span className="font-semibold">{formatUsd(tipsOwedCents)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-white/70">Paid</span>
            <span className="font-semibold">{formatUsd(tipsPaidCents)}</span>
          </div>
          <div className="mt-3 text-xs text-white/60">
            Tips are excluded from OTW driver cost and tracked separately.
          </div>
        </OtwCard>

        <OtwCard className="p-5 sm:p-6 lg:col-span-2">
          <div className="text-sm font-medium">Bonus Leakage (Proxy)</div>
          <div className="mt-2 flex items-center justify-between">
            <div className="text-xs text-white/60">Driver cost minus hourly-base estimate</div>
            <div className="text-sm font-semibold">{formatUsd(bonusLeakageCents)}</div>
          </div>
          <div className="mt-2 text-xs text-white/60">
            Base estimate uses each driver’s current hourly rate and logged active minutes.
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
                      {r.jobs} jobs • {r.miles.toLocaleString()} miles • {(r.complaintRate * 100).toFixed(0)}% complaints
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatUsd(r.costPerMile)}</div>
                    <div className="text-xs text-white/60">per mile</div>
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
