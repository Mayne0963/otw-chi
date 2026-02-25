import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getNeonSession } from '@/lib/auth/server';
import { getPrisma } from '@/lib/db';
import { serverFeatureFlags } from '@/lib/featureFlags';
import {
  isPickupPassExpired,
  purgeExpiredPickupPassForRequest,
} from '@/lib/pickup-pass';

const pickupCodeTypeSchema = z
  .union([z.enum(['QR', 'BARCODE', 'PIN', 'CONFIRMATION']), z.literal('')])
  .optional()
  .nullable();

const updateRequestSchema = z.object({
  orderReference: z.string().trim().max(120).optional().nullable(),
  pickupInstructions: z.string().trim().max(2000).optional().nullable(),
  dropoffInstructions: z.string().trim().max(2000).optional().nullable(),
  pickupCodeType: pickupCodeTypeSchema,
  pickupCodeText: z.string().trim().max(255).optional().nullable(),
});

const hasOwn = (value: unknown, key: string): boolean => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return Object.prototype.hasOwnProperty.call(value, key);
};

const normalizeOptionalString = (value: string | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getNeonSession();
    // @ts-ignore
    const userId = session?.userId || session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prisma = getPrisma();

    const user = await prisma.user.findUnique({ where: { neonAuthId: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const request = await prisma.deliveryRequest.findUnique({
      where: { id },
      omit: {
        pickupPassBase64: true,
      },
      include: {
        assignedDriver: {
          include: { user: true }
        },
        assignments: { orderBy: { assignedAt: 'desc' } }
      }
    });

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const isOwner = request.userId === user.id;
    const isDriver = request.assignedDriver?.userId === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isDriver && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let pickupPassBase64: string | null = null;
    let pickupPassMimeType: string | null = null;
    const now = new Date();

    if (isPickupPassExpired(request.pickupPassExpiresAt, now)) {
      await purgeExpiredPickupPassForRequest(prisma, request.id, now);
    } else {
      const pickupPassFallback = await prisma.deliveryRequest.findUnique({
        where: { id: request.id },
        select: {
          pickupPassBase64: true,
          pickupPassMimeType: true,
        },
      });

      pickupPassBase64 = pickupPassFallback?.pickupPassBase64 ?? null;
      pickupPassMimeType = pickupPassFallback?.pickupPassMimeType ?? null;
    }

    return NextResponse.json({
      ...request,
      pickupPassBase64,
      pickupPassMimeType,
    });
  } catch (error) {
    console.error('Get request details error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getNeonSession();
    // @ts-ignore
    const neonAuthUserId = session?.userId || session?.user?.id;

    if (!neonAuthUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { neonAuthId: neonAuthUserId } });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const requestRecord = await prisma.deliveryRequest.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!requestRecord) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const isOwner = requestRecord.userId === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rawBody = await req.json();
    const parsed = updateRequestSchema.parse(rawBody);

    const touchesPickupCode =
      hasOwn(rawBody, 'pickupCodeType') || hasOwn(rawBody, 'pickupCodeText');

    if (touchesPickupCode && !serverFeatureFlags.pickupPass) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const data: {
      orderReference?: string | null;
      pickupInstructions?: string | null;
      dropoffInstructions?: string | null;
      pickupCodeType?: string | null;
      pickupCodeText?: string | null;
    } = {};

    if (hasOwn(rawBody, 'orderReference')) {
      data.orderReference = normalizeOptionalString(parsed.orderReference);
    }

    if (hasOwn(rawBody, 'pickupInstructions')) {
      data.pickupInstructions = normalizeOptionalString(parsed.pickupInstructions);
    }

    if (hasOwn(rawBody, 'dropoffInstructions')) {
      data.dropoffInstructions = normalizeOptionalString(parsed.dropoffInstructions);
    }

    if (hasOwn(rawBody, 'pickupCodeType')) {
      data.pickupCodeType = normalizeOptionalString(parsed.pickupCodeType);
    }

    if (hasOwn(rawBody, 'pickupCodeText')) {
      data.pickupCodeText = normalizeOptionalString(parsed.pickupCodeText);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
    }

    const updated = await prisma.deliveryRequest.update({
      where: { id },
      data,
      select: {
        id: true,
        orderReference: true,
        pickupInstructions: true,
        dropoffInstructions: true,
        pickupCodeType: true,
        pickupCodeText: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ request: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    console.error('Update request error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
