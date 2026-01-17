type EnvRequirement = {
  key: string;
  public: boolean;
  optional?: boolean;
  description?: string;
};

const SERVER_ENV: EnvRequirement[] = [
  { key: "DATABASE_URL", public: false, description: "Postgres connection string (Neon/Vercel Postgres)" },
  { key: "CLERK_SECRET_KEY", public: false, description: "Clerk backend key" },
  { key: "CLERK_WEBHOOK_SECRET", public: false, optional: true, description: "Clerk webhook verification" },
  { key: "HERE_API_KEY", public: false, description: "HERE REST API key for routing/traffic" },
  { key: "STRIPE_SECRET_KEY", public: false, description: "Stripe secret key" },
  { key: "STRIPE_WEBHOOK_SECRET", public: false, optional: true, description: "Stripe webhook verification" },
  { key: "STRIPE_PRICE_BASIC", public: false, optional: true, description: "Stripe price ID: Basic" },
  { key: "STRIPE_PRICE_PLUS", public: false, optional: true, description: "Stripe price ID: Plus" },
  { key: "STRIPE_PRICE_EXEC", public: false, optional: true, description: "Stripe price ID: Executive" },
];

const CLIENT_ENV: EnvRequirement[] = [
  { key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", public: true, description: "Clerk publishable key" },
  { key: "NEXT_PUBLIC_HERE_MAPS_KEY", public: true, description: "HERE JS Maps key" },
  { key: "NEXT_PUBLIC_APP_URL", public: true, optional: true, description: "Public site URL" },
  { key: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", public: true, optional: true, description: "Stripe publishable key" },
  { key: "NEXT_PUBLIC_MAP_STYLE_URL", public: true, optional: true, description: "MapLibre style URL" },
];

export type EnvDiagnosticsResult = {
  missingServer: string[];
  missingClient: string[];
  warnings: string[];
  hasBlockingIssues: boolean;
};

export const getEnvDiagnostics = (): EnvDiagnosticsResult => {
  const dbUrlKeys = [
    "DATABASE_URL",
    "DIRECT_URL",
    "NEON_DATABASE_URL",
    "NEON_DATABASE_URL_NON_POOLING",
    "NEON_DATABASE_URL_UNPOOLED",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL",
    "POSTGRES_URL_NON_POOLING",
    "DATABASE_URL_NON_POOLING",
    "DATABASE_URL_UNPOOLED",
  ];

  const hasDbUrl = dbUrlKeys.some((key) => Boolean(process.env[key]));

  const missingServer = SERVER_ENV.filter((item) => {
    if (item.optional) return false;
    if (item.key === "DATABASE_URL") return !hasDbUrl;
    return !process.env[item.key];
  }).map((item) => item.key);
  const missingClient = CLIENT_ENV.filter((item) => !item.optional && !process.env[item.key]).map(
    (item) => item.key
  );

  const warnings: string[] = [];
  [...SERVER_ENV, ...CLIENT_ENV].forEach((item) => {
    if (item.optional && !process.env[item.key]) {
      warnings.push(item.key);
    }
  });

  return {
    missingServer,
    missingClient,
    warnings,
    hasBlockingIssues: missingServer.length > 0 || missingClient.length > 0,
  };
};

export const getClientEnvDiagnostics = (keys?: string[]) => {
  const required = keys && keys.length > 0 ? keys : CLIENT_ENV.filter((item) => !item.optional).map((i) => i.key);
  const missing = required.filter((key) => {
    const value = process.env[key as keyof NodeJS.ProcessEnv];
    return typeof value !== "string" || value.length === 0;
  });
  return {
    missing,
    ok: missing.length === 0,
  };
};
