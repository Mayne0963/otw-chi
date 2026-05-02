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

const getHereAllowedOrigin = (request?: Request): string | null => {
  const candidate =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    request?.headers.get("origin") ||
    request?.headers.get("referer");

  return normalizeOrigin(candidate);
};

export const getHereRequestHeaders = (request?: Request): Record<string, string> => {
  const origin = getHereAllowedOrigin(request);
  if (!origin) return {};

  // Some HERE API keys are restricted to "trusted domains". Server-side calls
  // must forward a valid Origin/Referer for those keys to authorize.
  return { Origin: origin, Referer: origin };
};
