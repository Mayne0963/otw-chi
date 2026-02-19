import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import { z } from 'zod';
import crypto from 'crypto';

const verifySchema = z.object({
  deliveryRequestId: z.string(),
});

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const formData = await req.formData();
    const deliveryRequestId = formData.get('deliveryRequestId') as string;
    const file = formData.get('receipt') as File;

    if (!deliveryRequestId || !file) {
      return new NextResponse('Missing deliveryRequestId or receipt file', { status: 400 });
    }

    const prisma = getPrisma();
    const deliveryRequest = await prisma.deliveryRequest.findUnique({
      where: { id: deliveryRequestId },
    });

    if (!deliveryRequest || deliveryRequest.userId !== user.id) {
      return new NextResponse('Delivery request not found or unauthorized', { status: 404 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const existingVerification = await prisma.receiptVerification.findUnique({
        where: { imageHash: hash },
    });

    if (existingVerification) {
        return new NextResponse('This receipt has already been uploaded.', { status: 409 });
    }

    // Call to Veryfi API will be added here

    return NextResponse.json({ success: true, message: 'Receipt verification in progress.' });
  } catch (error) {
    console.error('Receipt verification error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
