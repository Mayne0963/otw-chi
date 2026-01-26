function toNumber(value, fallback) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function normalizeRate(value) {
  const raw = toNumber(value, 0);
  const asFraction = raw > 1 ? raw / 100 : raw;
  return Math.max(0, Math.min(1, asFraction));
}

function getMetrics(raw) {
  const m = raw ?? {};
  return {
    avgRatingRolling: toNumber(m.avgRatingRolling, 0),
    onTimeRateRolling: normalizeRate(m.onTimeRateRolling),
    completedJobs: Math.max(0, Math.floor(toNumber(m.completedJobs, 0))),
    cancelRateRolling: normalizeRate(m.cancelRateRolling),
    flagsCount: Math.max(0, Math.floor(toNumber(m.flagsCount, 0))),
  };
}

function performanceScore(metrics) {
  return (
    metrics.avgRatingRolling * 50 +
    metrics.onTimeRateRolling * 40 -
    metrics.cancelRateRolling * 30 -
    metrics.flagsCount * 10
  );
}

function nextTier(currentTier, metrics) {
  if (currentTier === 'CONCIERGE') return 'CONCIERGE';
  if (metrics.completedJobs >= 150 && metrics.avgRatingRolling >= 4.9 && metrics.onTimeRateRolling >= 0.95) {
    return 'ELITE';
  }
  if (metrics.completedJobs >= 50 && metrics.avgRatingRolling >= 4.8 && metrics.onTimeRateRolling >= 0.9) {
    return 'STANDARD';
  }
  return 'PROBATION';
}

const cases = [
  {
    name: 'Elite threshold',
    currentTier: 'PROBATION',
    rawMetrics: { completedJobs: 150, avgRatingRolling: 4.9, onTimeRateRolling: 0.95, cancelRateRolling: 0, flagsCount: 0 },
    expectTier: 'ELITE',
  },
  {
    name: 'Standard threshold (percent input)',
    currentTier: 'PROBATION',
    rawMetrics: { completedJobs: 50, avgRatingRolling: 4.8, onTimeRateRolling: 90, cancelRateRolling: 0, flagsCount: 0 },
    expectTier: 'STANDARD',
  },
  {
    name: 'Concierge stays manual',
    currentTier: 'CONCIERGE',
    rawMetrics: { completedJobs: 999, avgRatingRolling: 5, onTimeRateRolling: 1, cancelRateRolling: 0, flagsCount: 0 },
    expectTier: 'CONCIERGE',
  },
];

for (const c of cases) {
  const m = getMetrics(c.rawMetrics);
  const tier = nextTier(c.currentTier, m);
  const score = performanceScore(m);
  if (tier !== c.expectTier) {
    throw new Error(`${c.name}: expected tier ${c.expectTier} but got ${tier}`);
  }
  if (!Number.isFinite(score)) {
    throw new Error(`${c.name}: score is not finite`);
  }
}

process.stdout.write('verify-driver-tier-logic: ok\n');
