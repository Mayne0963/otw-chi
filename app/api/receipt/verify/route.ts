import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import type { Prisma } from '@prisma/client';
import crypto from 'crypto';
import Client from '@veryfi/veryfi-sdk';
import { scoreReceiptRisk } from '@/lib/receipts/riskScore';

type ParsedMenuItem = {
  name: string;
  quantity: number;
  price: number;
};

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
    const normalized = raw.replace(/[^0-9.-]/g, '');
    if (!normalized) return null;
    const parsed = Number(normalized);
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

const parseMenuItems = (lineItems: unknown): ParsedMenuItem[] => {
  if (!Array.isArray(lineItems)) return [];

  const parsed: ParsedMenuItem[] = [];

  for (const lineItem of lineItems) {
    if (!lineItem || typeof lineItem !== 'object') continue;
    const line = lineItem as Record<string, unknown>;

    const name =
      extractString(line.description) ??
      extractString(line.full_description) ??
      extractString(line.normalized_description) ??
      extractString(line.text);
    if (!name) continue;

    const quantityRaw = extractNumber(line.quantity);
    const quantity = quantityRaw && quantityRaw > 0 ? Math.max(1, Math.round(quantityRaw)) : 1;

    const unitPrice =
      extractNumber(line.price) ??
      extractNumber(line.discount_price) ??
      (() => {
        const lineTotal =
          extractNumber(line.subtotal) ??
          extractNumber(line.total) ??
          extractNumber(line.net_total) ??
          extractNumber(line.gross_total);
        if (lineTotal == null || lineTotal <= 0) return null;
        return lineTotal / quantity;
      })();

    if (unitPrice == null || !Number.isFinite(unitPrice) || unitPrice <= 0) continue;

    parsed.push({
      name,
      quantity,
      price: Number(unitPrice.toFixed(2)),
    });
  }

  return parsed;
};

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const deliveryRequestId = formData.get('deliveryRequestId') as string;
    const file = formData.get('receipt') as File;

    if (!deliveryRequestId || !file) {
      return NextResponse.json({ message: 'Missing deliveryRequestId or receipt file' }, { status: 400 });
    }

    const prisma = getPrisma();
    const deliveryRequest = await prisma.deliveryRequest.findUnique({
      where: { id: deliveryRequestId },
    });

    if (!deliveryRequest || deliveryRequest.userId !== user.id) {
      return NextResponse.json({ message: 'Delivery request not found or unauthorized' }, { status: 404 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const existingVerification = await prisma.receiptVerification.findUnique({
      where: { imageHash: hash },
    });

    if (existingVerification) {
      const duplicateDecision = scoreReceiptRisk({
        isDuplicate: true,
        imageHash: hash,
      });
      return NextResponse.json(
        {
          success: false,
          message: 'This receipt has already been uploaded.',
          status: duplicateDecision.status,
          riskScore: duplicateDecision.riskScore,
          reasonCodes: duplicateDecision.reasonCodes,
          riskBreakdown: duplicateDecision.riskBreakdown,
        },
        { status: 409 }
      );
    }

    const expectedVendor = deliveryRequest.restaurantName ?? deliveryRequest.receiptVendor ?? null;
    const expectedTotal =
      typeof deliveryRequest.receiptSubtotalCents === 'number' && deliveryRequest.receiptSubtotalCents > 0
        ? (deliveryRequest.receiptSubtotalCents / 100).toFixed(2)
        : null;

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

      const menuItems = parseMenuItems((veryfiResponse as { line_items?: unknown }).line_items);
      const merchantName = extractString((veryfiResponse as { vendor?: { name?: unknown } }).vendor?.name);
      const merchantLocation =
        extractString((veryfiResponse as { vendor?: { address?: unknown } }).vendor?.address) ??
        extractString((veryfiResponse as { vendor?: { raw_address?: unknown } }).vendor?.raw_address);
      const subtotalFromResponse = extractNumber((veryfiResponse as { subtotal?: unknown }).subtotal);
      const taxAmount = extractNumber((veryfiResponse as { tax?: unknown }).tax);
      const tipAmount = extractNumber((veryfiResponse as { tip?: unknown }).tip);
      const totalAmount = extractNumber((veryfiResponse as { total?: unknown }).total);
      const receiptDate = extractDate((veryfiResponse as { date?: unknown }).date);
      const currencyCode = extractString((veryfiResponse as { currency_code?: unknown }).currency_code);
      const confidenceScore = (() => {
        const response = veryfiResponse as Record<string, unknown>;
        return (
          extractNumber(response.confidence_score) ??
          extractNumber(response.confidence) ??
          extractNumber(response.overall_confidence)
        );
      })();
      const subtotalCentsFromItems = menuItems.reduce(
        (sum, item) => sum + Math.round(item.price * 100) * item.quantity,
        0
      );
      const subtotalCents =
        subtotalCentsFromItems > 0
          ? subtotalCentsFromItems
          : subtotalFromResponse != null && subtotalFromResponse > 0
            ? Math.round(subtotalFromResponse * 100)
            : null;
      const receiptImageData = `data:${file.type || 'image/jpeg'};base64,${fileBuffer.toString('base64')}`;
      const scoreDecision = scoreReceiptRisk({
        deliveryRequestId,
        currentUserId: user.id,
        imageHash: hash,
        expectedVendor,
        expectedTotal,
        merchantName,
        subtotal: subtotalFromResponse,
        tax: taxAmount,
        tip: tipAmount,
        total: totalAmount,
        receiptDate,
        currency: currencyCode,
        confidenceScore,
      });

      const requestUpdateData: Prisma.DeliveryRequestUpdateInput = {
        receiptImageData,
        receiptVerifiedAt: new Date(),
        receiptAuthenticityScore: scoreDecision.riskScore / 100,
      };

      if (merchantName) {
        requestUpdateData.receiptVendor = merchantName;
        if (!deliveryRequest.restaurantName) {
          requestUpdateData.restaurantName = merchantName;
        }
      }
      if (merchantLocation) {
        requestUpdateData.receiptLocation = merchantLocation;
      }
      if (menuItems.length > 0) {
        requestUpdateData.receiptItems = menuItems as unknown as Prisma.InputJsonValue;
      }
      if (subtotalCents != null) {
        requestUpdateData.receiptSubtotalCents = subtotalCents;
      }

      await prisma.$transaction(async (tx) => {
        await tx.receiptVerification.create({
          data: {
            userId: user.id,
            deliveryRequestId,
            imageHash: hash,
            expectedVendor,
            merchantName,
            subtotalAmount: subtotalFromResponse,
            taxAmount,
            tipAmount,
            totalAmount,
            receiptDate,
            currency: currencyCode,
            confidenceScore: scoreDecision.normalizedConfidence,
            riskScore: scoreDecision.riskScore,
            status: scoreDecision.status,
            reasonCodes: scoreDecision.reasonCodes,
            riskBreakdown: scoreDecision.riskBreakdown as Prisma.InputJsonValue,
            rawResponse: veryfiResponse as unknown as Prisma.InputJsonValue,
          },
        });

        await tx.deliveryRequest.update({
          where: { id: deliveryRequestId },
          data: requestUpdateData,
        });
      });

      return NextResponse.json({
        success: scoreDecision.status === 'APPROVED',
        status: scoreDecision.status,
        riskScore: scoreDecision.riskScore,
        reasonCodes: scoreDecision.reasonCodes,
        riskBreakdown: scoreDecision.riskBreakdown,
        message: `Receipt processed (${scoreDecision.status}). Retrieved ${menuItems.length} menu item${menuItems.length === 1 ? '' : 's'}.`,
        menuItems,
        data: veryfiResponse,
      });
    } catch (error) {
      console.error('Veryfi API error:', error);
      const veryfiDecision = scoreReceiptRisk({
        veryfiError: true,
        imageHash: hash,
      });
      await prisma.receiptVerification.create({
        data: {
          userId: user.id,
          deliveryRequestId,
          imageHash: hash,
          expectedVendor,
          status: veryfiDecision.status,
          riskScore: veryfiDecision.riskScore,
          reasonCodes: veryfiDecision.reasonCodes,
          riskBreakdown: veryfiDecision.riskBreakdown as Prisma.InputJsonValue,
          rawResponse:
            {
              message: error instanceof Error ? error.message : 'Unknown Veryfi error',
            } as Prisma.InputJsonValue,
        },
      });
      return NextResponse.json(
        {
          success: false,
          message: 'Error processing receipt with Veryfi.',
          status: veryfiDecision.status,
          riskScore: veryfiDecision.riskScore,
          reasonCodes: veryfiDecision.reasonCodes,
          riskBreakdown: veryfiDecision.riskBreakdown,
        },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error('Receipt verification error:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
