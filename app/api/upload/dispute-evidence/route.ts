import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import {
  getDefaultStorageBucket,
  getSignedUrlForObjectRef,
  isStorageConfigured,
  uploadPrivateFile,
} from '@/lib/storage';

export const runtime = 'nodejs';

const DISPUTE_EVIDENCE_MAX_BYTES = 25 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/avif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
]);

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-m4v': 'm4v',
};

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      {
        error:
          'Dispute evidence uploads are currently unavailable. Paste a hosted image or video URL instead.',
      },
      { status: 503 }
    );
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

  if (file.size > DISPUTE_EVIDENCE_MAX_BYTES) {
    return NextResponse.json(
      { error: 'File too large. Max size is 25MB.' },
      { status: 400 }
    );
  }

  if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Use image or video formats.' },
      { status: 400 }
    );
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
  const objectKey = `dispute-evidence/${deliveryRequest.id}/${randomUUID()}.${extension}`;
  const objectRef = await uploadPrivateFile(
    objectKey,
    Buffer.from(await file.arrayBuffer()),
    file.type,
    getDefaultStorageBucket()
  );
  const signedUrl = await getSignedUrlForObjectRef(objectRef, 900);

  return NextResponse.json({
    ok: true,
    deliveryRequestId: deliveryRequest.id,
    evidenceRef: objectRef,
    evidenceUrl: signedUrl,
    contentType: file.type,
    fileName: file.name,
  });
}
