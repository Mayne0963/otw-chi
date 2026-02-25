
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { uploadFile } from '@/lib/storage';
import { randomUUID } from 'crypto';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const formData = await req.formData();
  const deliveryRequestId = formData.get('deliveryRequestId') as string;
  const file = formData.get('file') as File;

  if (!deliveryRequestId || !file) {
    return new NextResponse('Missing deliveryRequestId or file', { status: 400 });
  }

  const prisma = getPrisma();
  const deliveryRequest = await prisma.deliveryRequest.findUnique({
    where: { id: deliveryRequestId },
  });

  if (!deliveryRequest || (deliveryRequest.userId !== user.id && user.role !== 'ADMIN')) {
    return new NextResponse('Unauthorized', { status: 403 });
  }

  if (file.size > 5 * 1024 * 1024) { // 5MB limit
    return new NextResponse('File size exceeds 5MB', { status: 400 });
  }

  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return new NextResponse('Invalid file type', { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `pickup-passes/${deliveryRequestId}/${randomUUID()}`;
  const imageUrl = await uploadFile(process.env.S3_BUCKET!, key, buffer, file.type);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  await prisma.deliveryRequest.update({
    where: { id: deliveryRequestId },
    data: {
      pickupPassImageUrl: imageUrl,
      pickupPassUploadedAt: new Date(),
      pickupPassExpiresAt: expiresAt,
    },
  });

  return NextResponse.json({ imageUrl });
}
