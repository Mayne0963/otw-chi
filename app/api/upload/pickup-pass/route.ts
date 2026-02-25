import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { serverFeatureFlags } from '@/lib/featureFlags';
import {
  getPickupPassBase64CircuitStatus,
  PICKUP_PASS_EXPIRY_DAYS,
  PICKUP_PASS_BASE64_DISABLE_BYTES,
  PICKUP_PASS_BASE64_WARNING_BYTES,
  PICKUP_PASS_MAX_BYTES_BASE64,
  PICKUP_PASS_MAX_BYTES_STORAGE,
  toPickupPassDataUrl,
} from '@/lib/pickup-pass';
import {
  getDefaultStorageBucket,
  getSignedUrlForObjectRef,
  isStorageConfigured,
  uploadPrivateFile,
} from '@/lib/storage';

export const runtime = 'nodejs';

const ALLOWED_CONTENT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export async function POST(req: Request) {
  if (!serverFeatureFlags.pickupPass) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const storageConfigured = isStorageConfigured();

  const formData = await req.formData();
  const deliveryRequestId = String(formData.get('deliveryRequestId') ?? '').trim();
  const file = formData.get('file');

  if (!deliveryRequestId || !(file instanceof File)) {
    return NextResponse.json({ error: 'Missing deliveryRequestId or file' }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: 'File is empty' }, { status: 400 });
  }

  const maxUploadBytes = storageConfigured
    ? PICKUP_PASS_MAX_BYTES_STORAGE
    : PICKUP_PASS_MAX_BYTES_BASE64;

  if (file.size > maxUploadBytes) {
    return NextResponse.json(
      { error: 'Image too large. Please upload a smaller screenshot.' },
      { status: 400 },
    );
  }

  if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Invalid file type. Use PNG, JPG, or WEBP' }, { status: 400 });
  }

  const prisma = getPrisma();
  const deliveryRequest = await prisma.deliveryRequest.findUnique({
    where: { id: deliveryRequestId },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!deliveryRequest) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  const isOwner = deliveryRequest.userId === user.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!storageConfigured) {
    const circuitStatus = await getPickupPassBase64CircuitStatus(prisma, true);

    if (circuitStatus.totalBytes >= PICKUP_PASS_BASE64_WARNING_BYTES) {
      console.warn('[pickup-pass-upload] base64 usage warning', {
        totalBytes: circuitStatus.totalBytes,
        warningBytes: circuitStatus.warningBytes,
        disableBytes: circuitStatus.disableBytes,
        emergencyBytes: circuitStatus.emergencyBytes,
        overrideEnabled: circuitStatus.overrideEnabled,
      });
    }

    if (
      circuitStatus.overrideEnabled &&
      circuitStatus.totalBytes >= PICKUP_PASS_BASE64_WARNING_BYTES
    ) {
      console.warn('[pickup-pass-upload] OTW_BASE64_UPLOAD_OVERRIDE is enabled', {
        totalBytes: circuitStatus.totalBytes,
        disableBytes: circuitStatus.disableBytes,
      });
    }

    if (!circuitStatus.uploadsAllowed) {
      return NextResponse.json(
        {
          error: 'PICKUP_PASS_UPLOADS_PAUSED',
          message:
            'Pickup pass uploads are temporarily paused while we upgrade storage. Please paste your pickup code instead.',
          totalBytes: circuitStatus.totalBytes,
          thresholdBytes: PICKUP_PASS_BASE64_DISABLE_BYTES,
        },
        { status: 503 },
      );
    }
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + PICKUP_PASS_EXPIRY_DAYS);

  let pickupPassUrl: string | null = null;
  let pickupPassImageUrl: string | null = null;

  if (storageConfigured) {
    const extension = MIME_EXTENSION_MAP[file.type] ?? 'bin';
    const objectKey = `pickup-passes/${deliveryRequest.id}/${randomUUID()}.${extension}`;
    const objectRef = await uploadPrivateFile(
      objectKey,
      fileBuffer,
      file.type,
      getDefaultStorageBucket(),
    );

    pickupPassImageUrl = objectRef;
    pickupPassUrl = await getSignedUrlForObjectRef(objectRef, 900);

    await prisma.deliveryRequest.update({
      where: { id: deliveryRequest.id },
      data: {
        pickupPassImageUrl: objectRef,
        pickupPassBase64: null,
        pickupPassMimeType: null,
        pickupPassUploadedAt: now,
        pickupPassExpiresAt: expiresAt,
      },
    });
  } else {
    const base64 = fileBuffer.toString('base64');
    pickupPassUrl = toPickupPassDataUrl(base64, file.type);

    await prisma.deliveryRequest.update({
      where: { id: deliveryRequest.id },
      data: {
        pickupPassImageUrl: null,
        pickupPassBase64: base64,
        pickupPassMimeType: file.type,
        pickupPassUploadedAt: now,
        pickupPassExpiresAt: expiresAt,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    deliveryRequestId: deliveryRequest.id,
    pickupPassImageUrl,
    pickupPassUploadedAt: now.toISOString(),
    pickupPassExpiresAt: expiresAt.toISOString(),
    pickupPassUrl,
    storageMode: storageConfigured ? 'object' : 'base64',
  });
}

export async function DELETE(req: Request) {
  if (!serverFeatureFlags.pickupPass) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let deliveryRequestId = '';
  try {
    const body = await req.json();
    deliveryRequestId = String(body?.deliveryRequestId ?? '').trim();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!deliveryRequestId) {
    return NextResponse.json({ error: 'Missing deliveryRequestId' }, { status: 400 });
  }

  const prisma = getPrisma();
  const deliveryRequest = await prisma.deliveryRequest.findUnique({
    where: { id: deliveryRequestId },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!deliveryRequest) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  const isOwner = deliveryRequest.userId === user.id;
  const isAdmin = user.role === 'ADMIN';
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.deliveryRequest.update({
    where: { id: deliveryRequest.id },
    data: {
      pickupPassImageUrl: null,
      pickupPassBase64: null,
      pickupPassMimeType: null,
      pickupPassUploadedAt: null,
      pickupPassExpiresAt: null,
    },
  });

  return NextResponse.json({
    ok: true,
    deliveryRequestId: deliveryRequest.id,
  });
}
