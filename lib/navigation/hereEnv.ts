export const requireHereApiKey = () => {
  const key = process.env.HERE_API_KEY;
  if (!key) {
    throw new Error(
      "HERE_API_KEY is not set. Add it to your server env (Vercel env vars or .env.local) to enable HERE Routing/Traffic/Weather/POI calls."
    );
  }
  return key;
};

export const requireHereMapsBrowserKey = () => {
  const key = process.env.NEXT_PUBLIC_HERE_MAPS_KEY;
  if (!key) {
    throw new Error(
      "NEXT_PUBLIC_HERE_MAPS_KEY is not set. Add the domain-restricted JS Maps key to your env (Vercel + .env.local) for the driver map UI."
    );
  }
  return key;
};

const normalizeOrigin = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withScheme =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : /^[a-z0-9.-]+(?::\d+)?$/i.test(trimmed)
        ? `https://${trimmed}`
        : null;
  if (!withScheme) return null;

  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
};

const getRequestUrlOrigin = (request?: Request): string | null => {
  if (!request) return null;
  try {
    return normalizeOrigin(new URL(request.url).origin);
  } catch {
    return null;
  }
};

export const getHereAllowedOrigins = (request?: Request): string[] => {
  const rawCandidates = [
    request?.headers.get("origin"),
    request?.headers.get("referer"),
    getRequestUrlOrigin(request),
    request?.headers.get("x-forwarded-host"),
    request?.headers.get("host"),
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ];

  const seen = new Set<string>();
  const origins: string[] = [];

  for (const candidate of rawCandidates) {
    const normalized = normalizeOrigin(candidate);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    origins.push(normalized);
  }

  return origins;
};

export const getHereRequestHeaderCandidates = (request?: Request): Record<string, string>[] => {
  const origins = getHereAllowedOrigins(request);
  const candidates: Record<string, string>[] = origins.map((origin) => ({
    Origin: origin,
    Referer: `${origin}/`,
  }));

  candidates.push({});
  return candidates;
};

export const getHereRequestHeaders = (request?: Request): Record<string, string> => {
  return getHereRequestHeaderCandidates(request)[0] ?? {};
};
