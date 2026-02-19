import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import type { Prisma } from '@prisma/client';
import crypto from 'crypto';
import Client from '@veryfi/veryfi-sdk';

const extractValue = (value: unknown): unknown => {
  if (value && typeof value === 'object' && 'value' in value) {
    return (value as { value?: unknown }).value ?? null;
  }
  return value;
};

const extractString = (value: unknown): string | null => {
  const raw = extractValue(value);
  return typeof raw === 'string' && raw.trim() ? raw : null;
};

const extractNumber = (value: unknown): number | null => {
  const raw = extractValue(value);
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const extractDate = (value: unknown): Date | null => {
  const raw = extractValue(value);
  if (typeof raw !== 'string') return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

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

    const veryfiClient = new Client(
      process.env.VERYFI_CLIENT_ID!,
      process.env.VERYFI_CLIENT_SECRET,
      process.env.VERYFI_USERNAME!,
      process.env.VERYFI_API_KEY!
    );

    try {
      const veryfiResponse = await veryfiClient.process_document_from_base64(
        fileBuffer.toString('base64'),
        file.name,
        ['Food', 'Groceries']
      );

      await prisma.receiptVerification.create({
        data: {
          userId: user.id,
          deliveryRequestId,
          imageHash: hash,
          expectedVendor: deliveryRequest.restaurantName ?? deliveryRequest.receiptVendor ?? null,
          merchantName: extractString(veryfiResponse.vendor?.name),
          subtotalAmount: extractNumber(veryfiResponse.subtotal),
          taxAmount: extractNumber(veryfiResponse.tax),
          tipAmount: extractNumber(veryfiResponse.tip),
          totalAmount: extractNumber(veryfiResponse.total),
          receiptDate: extractDate(veryfiResponse.date),
          currency: extractString(veryfiResponse.currency_code),
          status: 'APPROVED',
          rawResponse: veryfiResponse as unknown as Prisma.InputJsonValue,
        },
      });

      return NextResponse.json({ success: true, message: 'Receipt verified successfully.', data: veryfiResponse });
    } catch (error) {
      console.error('Veryfi API error:', error);
      // Optionally create a verification record with a 'FAILED' status
      await prisma.receiptVerification.create({
        data: {
          userId: user.id,
          deliveryRequestId,
          imageHash: hash,
          status: 'REJECTED',
          reasonCodes: ['VERYFI_API_ERROR'],
          rawResponse:
            {
              message: error instanceof Error ? error.message : 'Unknown Veryfi error',
            } as Prisma.InputJsonValue,
        },
      });
      return new NextResponse('Error processing receipt with Veryfi.', { status: 500 });
    }
  } catch (error) {
    console.error('Receipt verification error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
