import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import { z } from 'zod';
import crypto from 'crypto';
import Client from '@veryfi/veryfi-sdk';

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

    const veryfiClient = new Client(process.env.VERYFI_CLIENT_ID!, {
      clientSecret: process.env.VERYFI_CLIENT_SECRET!,
      username: process.env.VERYFI_USERNAME!,
      apiKey: process.env.VERYFI_API_KEY!,
    });

    try {
      const veryfiResponse = await veryfiClient.process_document_buffer(fileBuffer, file.name, [
        "Food",
        "Groceries"
      ]);

      await prisma.receiptVerification.create({
        data: {
          deliveryRequestId,
          imageHash: hash,
          vendor: veryfiResponse.vendor?.name,
          totalAmount: veryfiResponse.total,
          taxAmount: veryfiResponse.tax,
          tipAmount: veryfiResponse.tip,
          receiptDate: veryfiResponse.date ? new Date(veryfiResponse.date) : null,
          status: 'VERIFIED', // Or based on some logic from the response
          rawResponse: veryfiResponse,
        },
      });

      return NextResponse.json({ success: true, message: 'Receipt verified successfully.', data: veryfiResponse });
    } catch (error) {
      console.error('Veryfi API error:', error);
      // Optionally create a verification record with a 'FAILED' status
      await prisma.receiptVerification.create({
        data: {
          deliveryRequestId,
          imageHash: hash,
          status: 'FAILED',
          rawResponse: error,
        },
      });
      return new NextResponse('Error processing receipt with Veryfi.', { status: 500 });
    }
  } catch (error) {
    console.error('Receipt verification error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
