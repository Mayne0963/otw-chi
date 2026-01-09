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
