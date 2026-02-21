import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import type { Prisma } from '@prisma/client';
import crypto from 'crypto';
import Client from '@veryfi/veryfi-sdk';
import { buildItemsSnapshot, computeTotalSnapshotDecimal } from '@/lib/disputes/orderConfirmation';
import { evaluateDeliveryRequestLock, applyDeliveryRequestLock } from '@/lib/refunds/lock';
import { computeProofScore } from '@/lib/receipts/proofScore';
import { getTestModeResult } from '@/lib/receipts/testMode';

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

const normalizeConfidence = (raw: number | null | undefined): number | null => {
  if (raw == null || !Number.isFinite(raw)) return null;
  if (raw >= 0 && raw <= 1) return raw * 100;
  if (raw >= 0 && raw <= 100) return raw;
  return null;
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
        ? (deliveryRequest.receiptSubtotalCents / 100)
        : null;

    // Check for TEST_MODE override
    const testModeResult = getTestModeResult(file.name);
    if (testModeResult) {
      const proofScoreResult = {
        proofScore: testModeResult.proofScore,
        itemMatchScore: 85, // Default good match for test mode
        imageQuality: 90,   // Default good quality for test mode
        tamperScore: 95,    // Default no tampering for test mode
        extractedTotal: expectedTotal,
        vendorName: expectedVendor,
        status: testModeResult.status,
        locked: testModeResult.status === 'APPROVED' || testModeResult.status === 'FLAGGED',
      };

      await prisma.$transaction(async (tx) => {
        const createdVerification = await tx.receiptVerification.create({
          data: {
            userId: user.id,
            deliveryRequestId,
            imageHash: hash,
            expectedVendor,
            merchantName: expectedVendor,
            subtotalAmount: expectedTotal,
            totalAmount: expectedTotal,
            confidenceScore: 0.9,
            riskScore: testModeResult.proofScore,
            status: testModeResult.status,
            reasonCodes: ['TEST_MODE'],
            proofScore: proofScoreResult.proofScore,
            extractedTotal: proofScoreResult.extractedTotal,
            vendorName: proofScoreResult.vendorName,
            itemMatchScore: proofScoreResult.itemMatchScore,
            imageQuality: proofScoreResult.imageQuality,
            tamperScore: proofScoreResult.tamperScore,
            locked: proofScoreResult.locked,
            riskBreakdown: {
              base: 100,
              penalties: [{ code: 'TEST_MODE', delta: testModeResult.proofScore - 100 }],
              fuzzyScore: null,
              diff: null,
              expectedTotal: expectedTotal?.toString() || null,
              extractedTotal: proofScoreResult.extractedTotal?.toString() || null,
            } as Prisma.InputJsonValue,
            rawResponse: { testMode: true, filename: file.name } as Prisma.InputJsonValue,
          },
        });

        await tx.deliveryRequest.update({
          where: { id: deliveryRequestId },
          data: {
            receiptImageData: `data:${file.type || 'image/jpeg'};base64,${fileBuffer.toString('base64')}`,
            receiptVerifiedAt: new Date(),
            receiptAuthenticityScore: testModeResult.proofScore / 100,
          },
        });

        if (proofScoreResult.locked) {
          const itemsSnapshot = buildItemsSnapshot([]);
          const totalSnapshot = computeTotalSnapshotDecimal({
            serviceType: deliveryRequest.serviceType,
            receiptSubtotalCents: deliveryRequest.receiptSubtotalCents,
            deliveryFeeCents: deliveryRequest.deliveryFeeCents,
            receiptImageData: `data:${file.type || 'image/jpeg'};base64,${fileBuffer.toString('base64')}`,
            receiptItems: [],
            quoteBreakdown: deliveryRequest.quoteBreakdown,
            discountCents: deliveryRequest.discountCents,
          });

          await tx.orderConfirmation.upsert({
            where: { deliveryRequestId },
            create: {
              deliveryRequestId,
              userId: user.id,
              itemsSnapshot: [] as unknown as Prisma.InputJsonValue,
              totalSnapshot,
              customerConfirmed: false,
              receiptVerificationId: createdVerification.id,
            },
            update: {
              receiptVerificationId: createdVerification.id,
              totalSnapshot,
            },
          });
        }
      });

      return NextResponse.json({
        success: testModeResult.status === 'APPROVED',
        status: testModeResult.status,
        proofScore: proofScoreResult.proofScore,
        itemMatchScore: proofScoreResult.itemMatchScore,
        imageQuality: proofScoreResult.imageQuality,
        tamperScore: proofScoreResult.tamperScore,
        extractedTotal: proofScoreResult.extractedTotal,
        vendorName: proofScoreResult.vendorName,
        locked: proofScoreResult.locked,
        message: testModeResult.message,
        menuItems: [],
        data: { testMode: true },
      });
    }

    // Validate Veryfi configuration
    const veryfiClientId = process.env.VERYFI_CLIENT_ID;
    const veryfiClientSecret = process.env.VERYFI_CLIENT_SECRET;
    const veryfiUsername = process.env.VERYFI_USERNAME;
    const veryfiApiKey = process.env.VERYFI_API_KEY;

    if (!veryfiClientId || !veryfiUsername || !veryfiApiKey) {
      return NextResponse.json(
        { message: 'Receipt verification service configuration incomplete' },
        { status: 500 }
      );
    }

    const veryfiClient = new Client(
      veryfiClientId,
      veryfiClientSecret,
      veryfiUsername,
      veryfiApiKey
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

      const proofScoreResult = computeProofScore({
        deliveryRequestId,
        merchantName,
        totalAmount,
        confidenceScore,
        expectedVendor,
        expectedTotal,
        menuItems,
        expectedItems: deliveryRequest.receiptItems,
      });

      const requestUpdateData: Prisma.DeliveryRequestUpdateInput = {
        receiptImageData,
        receiptVerifiedAt: new Date(),
        receiptAuthenticityScore: proofScoreResult.proofScore / 100,
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
        const createdVerification = await tx.receiptVerification.create({
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
            confidenceScore: normalizeConfidence(confidenceScore),
            riskScore: proofScoreResult.proofScore,
            status: proofScoreResult.status,
            reasonCodes: [], // Will be replaced by a more robust system
            riskBreakdown: {} as Prisma.InputJsonValue,
            rawResponse: veryfiResponse as unknown as Prisma.InputJsonValue,
            proofScore: proofScoreResult.proofScore,
            extractedTotal: proofScoreResult.extractedTotal,
            vendorName: proofScoreResult.vendorName,
            itemMatchScore: proofScoreResult.itemMatchScore,
            imageQuality: proofScoreResult.imageQuality,
            tamperScore: proofScoreResult.tamperScore,
            locked: proofScoreResult.locked,
          },
        });

        await tx.deliveryRequest.update({
          where: { id: deliveryRequestId },
          data: requestUpdateData,
        });

        if (proofScoreResult.locked) {
          const itemsSnapshot = buildItemsSnapshot(
            menuItems.length > 0 ? menuItems : deliveryRequest.receiptItems
          );
          const totalSnapshot = computeTotalSnapshotDecimal({
            serviceType: deliveryRequest.serviceType,
            receiptSubtotalCents:
              subtotalCents != null ? subtotalCents : deliveryRequest.receiptSubtotalCents,
            deliveryFeeCents: deliveryRequest.deliveryFeeCents,
            receiptImageData: receiptImageData,
            receiptItems: menuItems.length > 0 ? menuItems : deliveryRequest.receiptItems,
            quoteBreakdown: deliveryRequest.quoteBreakdown,
            discountCents: deliveryRequest.discountCents,
          });

          await tx.orderConfirmation.upsert({
            where: { deliveryRequestId },
            create: {
              deliveryRequestId,
              userId: user.id,
              itemsSnapshot: (itemsSnapshot.length > 0 ? itemsSnapshot : []) as unknown as Prisma.InputJsonValue,
              totalSnapshot,
              customerConfirmed: false,
              receiptVerificationId: createdVerification.id,
            },
            update: {
              receiptVerificationId: createdVerification.id,
              ...(itemsSnapshot.length > 0
                ? { itemsSnapshot: itemsSnapshot as unknown as Prisma.InputJsonValue }
                : {}),
              ...(totalSnapshot ? { totalSnapshot } : {}),
            },
          });
        }
      });

      // After successful receipt verification, evaluate and apply lock if needed
      if (proofScoreResult.locked) {
        await applyDeliveryRequestLock(deliveryRequestId, user.id);
      }

      return NextResponse.json({
        success: proofScoreResult.status === 'APPROVED',
        status: proofScoreResult.status,
        proofScore: proofScoreResult.proofScore,
        itemMatchScore: proofScoreResult.itemMatchScore,
        imageQuality: proofScoreResult.imageQuality,
        tamperScore: proofScoreResult.tamperScore,
        extractedTotal: proofScoreResult.extractedTotal,
        vendorName: proofScoreResult.vendorName,
        locked: proofScoreResult.locked,
        message: `Receipt processed (${proofScoreResult.status}). Retrieved ${menuItems.length} menu item${menuItems.length === 1 ? '' : 's'}.`,
        menuItems,
        data: veryfiResponse,
      });
    } catch (error) {
      console.error('Veryfi API error:', error);
      return NextResponse.json(
        {
          success: false,
          message: 'Error processing receipt with Veryfi.',
          status: 'REJECTED',
          proofScore: 0,
        },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error('Receipt verification error:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
