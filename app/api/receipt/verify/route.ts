import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import type { Prisma } from '@prisma/client';
import crypto from 'crypto';
import Client from '@veryfi/veryfi-sdk';
import { buildItemsSnapshot, computeTotalSnapshotDecimal } from '@/lib/disputes/orderConfirmation';
import { applyDeliveryRequestLock } from '@/lib/refunds/lock';
import { getTestModeResult } from '@/lib/receipts/testMode';
import {
  evaluateVeryfiReceipt,
  mapDecisionToReceiptStatus,
  type ReceiptDecision,
  type VeryfiReceiptEvaluation,
} from '@/lib/receipts/receiptValidity';


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

const statusToDecision = (status: string): ReceiptDecision => {
  if (status === 'APPROVED') return 'APPROVE';
  if (status === 'FLAGGED') return 'REVIEW';
  return 'REJECT';
};

const reasonCodeToMessage = (code: string): string => {
  switch (code) {
    case 'TOTAL_MISMATCH':
    case 'TOTAL_LARGE_MISMATCH':
    case 'TOTAL_PERCENT_MISMATCH':
    case 'TOTAL_SMALL_MISMATCH':
    case 'TOTAL_MATH_MISMATCH':
    case 'TOTALS_MISMATCH':
      return 'Totals do not add up';
    case 'LOW_CONFIDENCE':
    case 'VERY_LOW_CONFIDENCE':
    case 'LOW_OCR_SCORE':
      return 'Low OCR quality';
    case 'BLURRY_IMAGE':
      return 'Receipt appears blurry';
    case 'MERCHANT_MISSING':
    case 'MISSING_MERCHANT':
      return 'Missing merchant information';
    case 'DUPLICATE_RECEIPT':
      return 'Duplicate receipt detected';
    case 'SCREENSHOT_OR_LCD':
      return 'Possible screenshot or LCD photo';
    case 'FRAUD_COLOR_RED':
    case 'FRAUD_COLOR_YELLOW':
    case 'FRAUD_TYPES':
      return 'Possible fraud signals detected';
    case 'MISSING_CURRENCY':
    case 'CURRENCY_MISSING':
      return 'Missing currency code';
    case 'INVALID_TOTAL':
    case 'TOTAL_NOT_FOUND':
      return 'Missing or invalid total';
    default:
      return code
        .split('_')
        .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
        .join(' ');
  }
};

const toResponseReasons = (reasonCodes: string[], fallback: string[] = []): string[] => {
  if (fallback.length > 0) return fallback;
  const mapped = reasonCodes.map(reasonCodeToMessage).filter((reason) => reason.length > 0);
  return [...new Set(mapped)];
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
    const expectedVendor = deliveryRequest.restaurantName ?? deliveryRequest.receiptVendor ?? null;
    const expectedTotal =
      typeof deliveryRequest.receiptSubtotalCents === 'number' && deliveryRequest.receiptSubtotalCents > 0
        ? (deliveryRequest.receiptSubtotalCents / 100)
        : null;

    const existingVerification = await prisma.receiptVerification.findUnique({
      where: { imageHash: hash },
    });

    if (existingVerification) {
      if (existingVerification.deliveryRequestId === deliveryRequestId) {
        const existingMenuItems = parseMenuItems(
          (existingVerification.rawResponse as { line_items?: unknown } | null)?.line_items
        );
        const existingProofScore = existingVerification.proofScore ?? existingVerification.riskScore;
        const existingReasonCodes = Array.isArray(existingVerification.reasonCodes)
          ? existingVerification.reasonCodes
          : [];
        const existingBreakdown =
          existingVerification.riskBreakdown && typeof existingVerification.riskBreakdown === 'object'
            ? (existingVerification.riskBreakdown as Record<string, unknown>)
            : null;
        const existingDecisionRaw =
          typeof existingBreakdown?.decision === 'string' ? existingBreakdown.decision : null;
        const existingDecision =
          existingDecisionRaw === 'APPROVE' || existingDecisionRaw === 'REVIEW' || existingDecisionRaw === 'REJECT'
            ? existingDecisionRaw
            : statusToDecision(existingVerification.status);
        const existingPercentRealRaw =
          typeof existingBreakdown?.percentReal === 'number'
            ? existingBreakdown.percentReal
            : existingProofScore;
        const existingPercentReal = Math.max(0, Math.min(100, Math.round(existingPercentRealRaw)));
        const existingScores =
          existingBreakdown?.scores && typeof existingBreakdown.scores === 'object'
            ? (existingBreakdown.scores as Record<string, unknown>)
            : null;
        const authenticityScoreRaw =
          typeof existingScores?.authenticity === 'number' ? existingScores.authenticity : existingPercentReal / 100;
        const extractionScoreRaw =
          typeof existingScores?.extraction === 'number'
            ? existingScores.extraction
            : typeof existingVerification.imageQuality === 'number'
              ? existingVerification.imageQuality / 100
              : existingPercentReal / 100;
        const businessScoreRaw =
          typeof existingScores?.business === 'number' ? existingScores.business : existingPercentReal / 100;
        const existingReasons = toResponseReasons(
          existingReasonCodes,
          Array.isArray(existingBreakdown?.reasons)
            ? existingBreakdown.reasons.filter((item): item is string => typeof item === 'string' && item.length > 0)
            : []
        );

        return NextResponse.json({
          success: existingVerification.status === 'APPROVED',
          status: existingVerification.status,
          riskScore: existingVerification.riskScore,
          reasonCodes: existingReasonCodes,
          riskBreakdown: existingVerification.riskBreakdown,
          proofScore: existingProofScore,
          decision: existingDecision,
          percentReal: existingPercentReal,
          scores: {
            authenticity: Math.max(0, Math.min(1, authenticityScoreRaw)),
            extraction: Math.max(0, Math.min(1, extractionScoreRaw)),
            business: Math.max(0, Math.min(1, businessScoreRaw)),
          },
          reasons: existingDecision === 'APPROVE' ? [] : existingReasons,
          itemMatchScore: existingVerification.itemMatchScore,
          imageQuality: existingVerification.imageQuality,
          tamperScore: existingVerification.tamperScore,
          extractedTotal: existingVerification.extractedTotal,
          vendorName:
            existingVerification.vendorName ??
            existingVerification.merchantName ??
            expectedVendor,
          locked: existingVerification.locked,
          message: 'This receipt is already verified for this order.',
          menuItems: existingMenuItems,
          data: existingVerification.rawResponse,
        });
      }

      const duplicateDecision: VeryfiReceiptEvaluation = {
        decision: 'REJECT',
        percentReal: 0,
        scores: {
          authenticity: 0,
          extraction: 1,
          business: 1,
        },
        reasons: ['Duplicate receipt detected'],
        reasonCodes: ['DUPLICATE_RECEIPT'],
        meta: {
          fraudScore: null,
          fraudColor: null,
          fraudTypes: ['duplicate'],
          ocrScore: null,
          blurry: false,
        },
      };
      console.info('[receipt-verify] duplicate detected', {
        deliveryRequestId,
        decision: duplicateDecision.decision,
        percentReal: duplicateDecision.percentReal,
        reasons: duplicateDecision.reasons,
      });
      return NextResponse.json(
        {
          success: false,
          message: 'This receipt has already been uploaded.',
          status: 'REJECTED',
          riskScore: duplicateDecision.percentReal,
          reasonCodes: duplicateDecision.reasonCodes,
          riskBreakdown: {
            model: 'veryfi-receipt-validity-v1',
            decision: duplicateDecision.decision,
            percentReal: duplicateDecision.percentReal,
            scores: duplicateDecision.scores,
            reasons: duplicateDecision.reasons,
            reasonCodes: duplicateDecision.reasonCodes,
          },
          decision: duplicateDecision.decision,
          percentReal: duplicateDecision.percentReal,
          scores: duplicateDecision.scores,
          reasons: duplicateDecision.reasons,
          proofScore: duplicateDecision.percentReal,
        },
        { status: 409 }
      );
    }

    // Check for TEST_MODE override
    const testModeResult = getTestModeResult(file.name);
    if (testModeResult) {
      const decision: ReceiptDecision =
        testModeResult.status === 'APPROVED'
          ? 'APPROVE'
          : testModeResult.status === 'FLAGGED'
            ? 'REVIEW'
            : 'REJECT';
      const percentReal = Math.max(0, Math.min(100, Math.round(testModeResult.proofScore)));
      const scores = {
        authenticity: Math.max(0, Math.min(1, percentReal / 100)),
        extraction: Math.max(0, Math.min(1, percentReal / 100)),
        business: Math.max(0, Math.min(1, percentReal / 100)),
      };
      const reasonCodes = ['TEST_MODE'];
      const reasons = decision === 'APPROVE' ? [] : ['Test mode review required'];
      const riskBreakdown = {
        model: 'veryfi-receipt-validity-v1',
        decision,
        percentReal,
        scores,
        reasons,
        reasonCodes,
        expectedTotal: expectedTotal?.toString() || null,
        extractedTotal: expectedTotal?.toString() || null,
        testMode: true,
      } as Prisma.InputJsonValue;
      const status = mapDecisionToReceiptStatus(decision);
      const locked = status === 'APPROVED' || status === 'FLAGGED';
      const imageQuality = 90;
      const tamperScore = 95;
      const extractedTotal = expectedTotal;
      const vendorName = expectedVendor;
      const proofScore = percentReal;
      const itemMatchScore = null;

      await prisma.$transaction(async (tx) => {
        const createdVerification = await tx.receiptVerification.upsert({
          where: { deliveryRequestId },
          create: {
            userId: user.id,
            deliveryRequestId,
            imageHash: hash,
            expectedVendor,
            merchantName: expectedVendor,
            subtotalAmount: expectedTotal,
            totalAmount: expectedTotal,
            confidenceScore: 90,
            riskScore: percentReal,
            status,
            reasonCodes,
            proofScore,
            extractedTotal,
            vendorName,
            itemMatchScore,
            imageQuality,
            tamperScore,
            locked,
            riskBreakdown,
            rawResponse: { testMode: true, filename: file.name } as Prisma.InputJsonValue,
          },
          update: {
            imageHash: hash,
            expectedVendor,
            merchantName: expectedVendor,
            subtotalAmount: expectedTotal,
            totalAmount: expectedTotal,
            confidenceScore: 90,
            riskScore: percentReal,
            status,
            reasonCodes,
            proofScore,
            extractedTotal,
            vendorName,
            itemMatchScore,
            imageQuality,
            tamperScore,
            locked,
            riskBreakdown,
            rawResponse: { testMode: true, filename: file.name } as Prisma.InputJsonValue,
          },
        });

        await tx.deliveryRequest.update({
          where: { id: deliveryRequestId },
          data: {
            receiptImageData: `data:${file.type || 'image/jpeg'};base64,${fileBuffer.toString('base64')}`,
            receiptVerifiedAt: new Date(),
            receiptAuthenticityScore: percentReal / 100,
          },
        });

        if (locked) {
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

      console.info('[receipt-verify] test mode evaluation', {
        deliveryRequestId,
        decision,
        percentReal,
        reasons,
      });
      return NextResponse.json({
        success: status === 'APPROVED',
        status,
        riskScore: percentReal,
        reasonCodes,
        riskBreakdown,
        proofScore,
        decision,
        percentReal,
        scores,
        reasons,
        itemMatchScore,
        imageQuality,
        tamperScore,
        extractedTotal,
        vendorName,
        locked,
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
      const evaluation = evaluateVeryfiReceipt(veryfiResponse);
      const status = mapDecisionToReceiptStatus(evaluation.decision);
      const locked = status === 'APPROVED' || status === 'FLAGGED';
      const proofScore = evaluation.percentReal;
      const itemMatchScore = null;
      const imageQuality = Math.round(evaluation.scores.extraction * 100);
      const tamperScore = null;
      const extractedTotal = totalAmount ?? null;
      const vendorName = merchantName ?? null;
      const riskBreakdown = {
        model: 'veryfi-receipt-validity-v1',
        decision: evaluation.decision,
        percentReal: evaluation.percentReal,
        scores: evaluation.scores,
        reasons: evaluation.reasons,
        reasonCodes: evaluation.reasonCodes,
        weights: {
          authenticity: 0.45,
          extraction: 0.35,
          business: 0.2,
        },
        veryfi: evaluation.meta,
      };

      const requestUpdateData: Prisma.DeliveryRequestUpdateInput = {
        receiptImageData,
        receiptVerifiedAt: new Date(),
        receiptAuthenticityScore: evaluation.percentReal / 100,
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
        const createdVerification = await tx.receiptVerification.upsert({
          where: { deliveryRequestId },
          create: {
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
            confidenceScore: imageQuality,
            riskScore: evaluation.percentReal,
            status,
            reasonCodes: evaluation.reasonCodes,
            riskBreakdown: riskBreakdown as unknown as Prisma.InputJsonValue,
            rawResponse: veryfiResponse as unknown as Prisma.InputJsonValue,
            proofScore,
            extractedTotal,
            vendorName,
            itemMatchScore,
            imageQuality,
            tamperScore,
            locked,
          },
          update: {
            imageHash: hash,
            expectedVendor,
            merchantName,
            subtotalAmount: subtotalFromResponse,
            taxAmount,
            tipAmount,
            totalAmount,
            receiptDate,
            currency: currencyCode,
            confidenceScore: imageQuality,
            riskScore: evaluation.percentReal,
            status,
            reasonCodes: evaluation.reasonCodes,
            riskBreakdown: riskBreakdown as unknown as Prisma.InputJsonValue,
            rawResponse: veryfiResponse as unknown as Prisma.InputJsonValue,
            proofScore,
            extractedTotal,
            vendorName,
            itemMatchScore,
            imageQuality,
            tamperScore,
            locked,
          },
        });

        await tx.deliveryRequest.update({
          where: { id: deliveryRequestId },
          data: requestUpdateData,
        });

        if (locked) {
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
      if (locked) {
        await applyDeliveryRequestLock(deliveryRequestId, user.id);
      }

      console.info('[receipt-verify] evaluation', {
        deliveryRequestId,
        decision: evaluation.decision,
        percentReal: evaluation.percentReal,
        reasons: evaluation.reasons,
      });

      return NextResponse.json({
        success: status === 'APPROVED',
        status,
        riskScore: evaluation.percentReal,
        reasonCodes: evaluation.reasonCodes,
        riskBreakdown,
        proofScore,
        decision: evaluation.decision,
        percentReal: evaluation.percentReal,
        scores: evaluation.scores,
        reasons: evaluation.reasons,
        itemMatchScore,
        imageQuality,
        tamperScore,
        extractedTotal,
        vendorName,
        locked,
        message: `Receipt processed (${status}). Retrieved ${menuItems.length} menu item${menuItems.length === 1 ? '' : 's'}.`,
        menuItems,
        data: veryfiResponse,
      });
    } catch (error) {
      console.error('Veryfi API error:', error);
      const fallbackReasonCodes = ['VERYFI_ERROR'];
      const fallbackReasons = ['Automatic receipt verification is temporarily unavailable. Receipt saved for review.'];
      const fallbackErrorMessage =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : 'Unknown Veryfi API error';
      const fallbackRiskBreakdown = {
        model: 'veryfi-receipt-validity-v1',
        decision: 'REVIEW',
        percentReal: 0,
        scores: {
          authenticity: 0,
          extraction: 0,
          business: 0,
        },
        reasons: fallbackReasons,
        reasonCodes: fallbackReasonCodes,
        veryfiError: fallbackErrorMessage,
      } as Prisma.InputJsonValue;
      const fallbackImageData = `data:${file.type || 'image/jpeg'};base64,${fileBuffer.toString('base64')}`;

      await prisma.$transaction(async (tx) => {
        await tx.receiptVerification.upsert({
          where: { deliveryRequestId },
          create: {
            userId: user.id,
            deliveryRequestId,
            imageHash: hash,
            expectedVendor,
            merchantName: expectedVendor,
            subtotalAmount: expectedTotal,
            totalAmount: expectedTotal,
            confidenceScore: 0,
            riskScore: 0,
            status: 'PENDING',
            reasonCodes: fallbackReasonCodes,
            riskBreakdown: fallbackRiskBreakdown,
            rawResponse: {
              veryfiError: fallbackErrorMessage,
              retriable: true,
            } as Prisma.InputJsonValue,
            proofScore: 0,
            extractedTotal: expectedTotal,
            vendorName: expectedVendor,
            itemMatchScore: null,
            imageQuality: 0,
            tamperScore: null,
            locked: false,
          },
          update: {
            imageHash: hash,
            expectedVendor,
            merchantName: expectedVendor,
            subtotalAmount: expectedTotal,
            totalAmount: expectedTotal,
            confidenceScore: 0,
            riskScore: 0,
            status: 'PENDING',
            reasonCodes: fallbackReasonCodes,
            riskBreakdown: fallbackRiskBreakdown,
            rawResponse: {
              veryfiError: fallbackErrorMessage,
              retriable: true,
            } as Prisma.InputJsonValue,
            proofScore: 0,
            extractedTotal: expectedTotal,
            vendorName: expectedVendor,
            itemMatchScore: null,
            imageQuality: 0,
            tamperScore: null,
            locked: false,
          },
        });

        await tx.deliveryRequest.update({
          where: { id: deliveryRequestId },
          data: {
            receiptImageData: fallbackImageData,
            receiptVendor: expectedVendor,
            receiptVerifiedAt: null,
            receiptAuthenticityScore: null,
          },
        });
      });

      return NextResponse.json({
        success: false,
        message: 'Receipt uploaded. Automatic verification is temporarily unavailable, so this was saved for manual review.',
        status: 'PENDING',
        riskScore: 0,
        reasonCodes: fallbackReasonCodes,
        riskBreakdown: fallbackRiskBreakdown,
        proofScore: 0,
        decision: 'REVIEW',
        percentReal: 0,
        scores: {
          authenticity: 0,
          extraction: 0,
          business: 0,
        },
        reasons: fallbackReasons,
        itemMatchScore: null,
        imageQuality: 0,
        tamperScore: null,
        extractedTotal: expectedTotal,
        vendorName: expectedVendor,
        locked: false,
        menuItems: [],
        data: { veryfiError: fallbackErrorMessage, retriable: true },
      });
    }
  } catch (error) {
    console.error('Receipt verification error:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
