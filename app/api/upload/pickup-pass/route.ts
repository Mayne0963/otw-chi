import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { serverFeatureFlags } from '@/lib/featureFlags';
import {
  getDefaultStorageBucket,
  getSignedUrlForObjectRef,
  isStorageConfigured,
  uploadPrivateFile,
} from '@/lib/storage';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const PICKUP_PASS_EXPIRY_DAYS = 14;

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

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: 'Storage is not configured' }, { status: 500 });
  }

  const formData = await req.formData();
  const deliveryRequestId = String(formData.get('deliveryRequestId') ?? '').trim();
  const file = formData.get('file');

  if (!deliveryRequestId || !(file instanceof File)) {
    return NextResponse.json({ error: 'Missing deliveryRequestId or file' }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: 'File is empty' }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'File size exceeds 5MB' }, { status: 400 });
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

  const extension = MIME_EXTENSION_MAP[file.type] ?? 'bin';
  const objectKey = `pickup-passes/${deliveryRequest.id}/${randomUUID()}.${extension}`;
  const objectRef = await uploadPrivateFile(
    objectKey,
    Buffer.from(await file.arrayBuffer()),
    file.type,
    getDefaultStorageBucket(),
  );

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + PICKUP_PASS_EXPIRY_DAYS);

  await prisma.deliveryRequest.update({
    where: { id: deliveryRequest.id },
    data: {
      pickupPassImageUrl: objectRef,
      pickupPassUploadedAt: now,
      pickupPassExpiresAt: expiresAt,
    },
  });

  const signedUrl = await getSignedUrlForObjectRef(objectRef, 900);

  return NextResponse.json({
    ok: true,
    deliveryRequestId: deliveryRequest.id,
    pickupPassImageUrl: objectRef,
    pickupPassUploadedAt: now.toISOString(),
    pickupPassExpiresAt: expiresAt.toISOString(),
    pickupPassUrl: signedUrl,
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
      pickupPassUploadedAt: null,
      pickupPassExpiresAt: null,
    },
  });

  return NextResponse.json({
    ok: true,
    deliveryRequestId: deliveryRequest.id,
  });
}
