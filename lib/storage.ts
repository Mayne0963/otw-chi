import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

type StorageProvider = 's3';

export type ParsedStorageObjectRef = {
  bucket: string;
  key: string;
};

let cachedS3Client: S3Client | null = null;

function getStorageProvider(): StorageProvider {
  const provider = (process.env.STORAGE_PROVIDER ?? 's3').trim().toLowerCase();

  if (provider !== 's3') {
    throw new Error(`Unsupported storage provider: ${provider}`);
  }

  return provider;
}

function requireEnvValue(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getS3Client(): S3Client {
  getStorageProvider();

  if (cachedS3Client) {
    return cachedS3Client;
  }

  const region = requireEnvValue('S3_REGION');
  const accessKeyId = requireEnvValue('S3_ACCESS_KEY');
  const secretAccessKey = requireEnvValue('S3_SECRET_KEY');

  cachedS3Client = new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return cachedS3Client;
}

export function getDefaultStorageBucket(): string {
  return requireEnvValue('S3_BUCKET');
}

export function isStorageConfigured(): boolean {
  try {
    getStorageProvider();
    getDefaultStorageBucket();
    requireEnvValue('S3_REGION');
    requireEnvValue('S3_ACCESS_KEY');
    requireEnvValue('S3_SECRET_KEY');
    return true;
  } catch {
    return false;
  }
}

export async function uploadFile(
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: 'private, max-age=0, no-store',
  });

  await getS3Client().send(command);
  return `s3://${bucket}/${key}`;
}

export async function uploadPrivateFile(
  key: string,
  body: Buffer,
  contentType: string,
  bucket = getDefaultStorageBucket(),
): Promise<string> {
  return uploadFile(bucket, key, body, contentType);
}

export function parseStorageObjectRef(
  value: string,
  defaultBucket = process.env.S3_BUCKET,
): ParsedStorageObjectRef | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('s3://')) {
    const withoutProtocol = trimmed.slice('s3://'.length);
    const slashIndex = withoutProtocol.indexOf('/');
    if (slashIndex <= 0) {
      return null;
    }

    const bucket = withoutProtocol.slice(0, slashIndex);
    const key = withoutProtocol.slice(slashIndex + 1);
    if (!bucket || !key) {
      return null;
    }

    return { bucket, key };
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      const keyFromPath = parsed.pathname.replace(/^\/+/, '');

      if (!keyFromPath) {
        return null;
      }

      if (parsed.hostname === 's3.amazonaws.com') {
        const [bucket, ...rest] = keyFromPath.split('/');
        if (bucket && rest.length > 0) {
          return { bucket, key: rest.join('/') };
        }
      }

      const virtualHostMatch = parsed.hostname.match(/^([^./]+)\.s3[.-].+/);
      if (virtualHostMatch && virtualHostMatch[1]) {
        return { bucket: virtualHostMatch[1], key: keyFromPath };
      }

      if (defaultBucket && defaultBucket.trim().length > 0) {
        return { bucket: defaultBucket, key: keyFromPath };
      }

      return null;
    } catch {
      return null;
    }
  }

  if (!defaultBucket || defaultBucket.trim().length === 0) {
    return null;
  }

  return {
    bucket: defaultBucket,
    key: trimmed.replace(/^\/+/, ''),
  };
}

export async function getSignedUrlForRead(
  bucket: string,
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(getS3Client(), command, { expiresIn: expiresInSeconds });
}

export async function getSignedUrlForObjectRef(
  objectRef: string,
  expiresInSeconds = 900,
): Promise<string | null> {
  const parsed = parseStorageObjectRef(objectRef);
  if (!parsed) {
    return null;
  }

  return getSignedUrlForRead(parsed.bucket, parsed.key, expiresInSeconds);
}
