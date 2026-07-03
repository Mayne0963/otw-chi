type Bucket = {
  tokens: number;
  last: number;
  intervalMs: number;
  capacity: number;
};

const buckets = new Map<string, Bucket>();

export const rateLimit = ({
  key,
  intervalMs,
  max,
}: {
  key: string;
  intervalMs: number;
  max: number;
}) => {
  const now = Date.now();
  const bucket = buckets.get(key) || {
    tokens: max,
    last: now,
    intervalMs,
    capacity: max,
  };

  const elapsed = now - bucket.last;
  if (elapsed > 0) {
    const refill = Math.floor(elapsed / intervalMs) * max;
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + refill);
    bucket.last = now;
  }

  if (bucket.tokens <= 0) {
    buckets.set(key, bucket);
    return { allowed: false, retryAfterMs: intervalMs };
  }

  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return { allowed: true, retryAfterMs: 0 };
};
