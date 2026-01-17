import "server-only";

export type DatabaseUrlSource = {
  url: string;
  envKey: string;
};

const DATABASE_URL_KEYS = [
  "DATABASE_URL",
  "NEON_DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
] as const;

const DIRECT_DATABASE_URL_KEYS = [
  "DIRECT_URL",
  "DATABASE_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
  "NEON_DATABASE_URL_NON_POOLING",
  "NEON_DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
] as const;

const readEnvValue = (key: string) => {
  const value = process.env[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("psql ")) {
    const match = trimmed.match(/psql ['"]([^'"]+)['"]/);
    if (match?.[1]) return match[1];
  }
  return trimmed;
};

export const getDatabaseUrlSource = (): DatabaseUrlSource => {
  for (const key of DATABASE_URL_KEYS) {
    const value = readEnvValue(key);
    if (value) return { url: value, envKey: key };
  }

  for (const key of DIRECT_DATABASE_URL_KEYS) {
    const value = readEnvValue(key);
    if (value) return { url: value, envKey: key };
  }

  throw new Error(
    `Missing database connection string. Set one of: ${[
      ...DATABASE_URL_KEYS,
      ...DIRECT_DATABASE_URL_KEYS,
    ].join(", ")}`
  );
};

export const getDatabaseUrl = () => getDatabaseUrlSource().url;

export const getDirectDatabaseUrlSource = (): DatabaseUrlSource | null => {
  for (const key of DIRECT_DATABASE_URL_KEYS) {
    const value = readEnvValue(key);
    if (value) return { url: value, envKey: key };
  }
  return null;
};

export const getDirectDatabaseUrl = () => getDirectDatabaseUrlSource()?.url ?? null;
