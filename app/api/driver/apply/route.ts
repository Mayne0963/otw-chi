import { NextResponse } from 'next/server';
import { extractNeonAuthEmail, extractNeonAuthUserId, getNeonSession } from '@/lib/auth/server';
import { getPrisma } from '@/lib/db';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { DriverApplicationStatus } from '@prisma/client';

export const runtime = 'nodejs';

const applicationSchema = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().trim().email(),
  phone: z.string().trim().min(10),
  city: z.string().trim().min(2),
  vehicleType: z.string().trim().min(2),
  availability: z.string().trim().min(1),
  whyOtwAnswer: z.string().trim().min(2),
});

const activeApplicationStatuses: DriverApplicationStatus[] = ['PENDING', 'WAITLIST', 'APPROVED'];

function normalizeEmail(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function serializeApplicationSummary<T extends {
  id: string;
  status: DriverApplicationStatus;
  city: string;
  vehicleType: string;
  fullName: string;
  email: string;
  phone: string;
  availability: string | null;
  whyOtwAnswer: string | null;
  message: string | null;
  createdAt: Date;
  updatedAt: Date;
}>(application: T | null) {
  if (!application) return null;

  return {
    id: application.id,
    status: application.status,
    city: application.city,
    vehicleType: application.vehicleType,
    fullName: application.fullName,
    email: application.email,
    phone: application.phone,
    availability: application.availability,
    whyOtwAnswer: application.message ?? application.whyOtwAnswer ?? null,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
}

export async function POST(req: Request) {
  try {
    const session = await getNeonSession();
    const userId = extractNeonAuthUserId(session);

    const prisma = getPrisma();

    const body = await req.json();
    const data = applicationSchema.parse(body);

    let dbUserId: string | null = null;
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { neonAuthId: userId },
        select: { id: true, email: true },
      });
      dbUserId = user?.id ?? null;
    }

    const normalizedEmail = data.email.toLowerCase();

    // Guest users can apply, but their email must not be attached to a different account.
    const accountWithEmail = await prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (accountWithEmail && accountWithEmail.id !== dbUserId) {
      return new NextResponse('This email is already attached to an existing account.', { status: 409 });
    }

    // Signed-in users can only have one pending application.
    if (dbUserId) {
      const existingByUser = await prisma.driverApplication.findFirst({
        where: { userId: dbUserId, status: { in: activeApplicationStatuses } },
      });
      if (existingByUser) {
        return new NextResponse('You already have an active application in review.', { status: 409 });
      }
    }

    // Prevent duplicate active applications by email (including guests).
    const existingByEmail = await prisma.driverApplication.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
        status: { in: activeApplicationStatuses },
      },
      select: { id: true },
    });
    if (existingByEmail) {
      return new NextResponse('An application with this email is already active.', { status: 409 });
    }

    const created = await prisma.driverApplication.create({
      data: {
        userId: dbUserId || undefined,
        email: normalizedEmail,
        fullName: data.fullName,
        phone: data.phone,
        city: data.city,
        vehicleType: data.vehicleType,
        availability: data.availability,
        message: data.whyOtwAnswer,
        whyOtwAnswer: data.whyOtwAnswer,
        notes: data.whyOtwAnswer,
      },
      select: {
        id: true,
        status: true,
        email: true,
        phone: true,
        city: true,
        vehicleType: true,
        availability: true,
        whyOtwAnswer: true,
        message: true,
        fullName: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      application: serializeApplicationSummary(created),
    });
  } catch (error) {
    console.error('Driver application error:', error);
    return new NextResponse('Invalid application data', { status: 400 });
  }
}

export async function GET() {
  try {
    const session = await getNeonSession();
    const userId = extractNeonAuthUserId(session);
    const sessionEmail = normalizeEmail(extractNeonAuthEmail(session));
    if (!userId && !sessionEmail) {
      return NextResponse.json({ application: null }, { status: 401 });
    }

    const prisma = getPrisma();
    let dbUserId: string | null = null;
    let dbUserEmail: string | null = null;
    if (userId) {
      const dbUser = await prisma.user.findUnique({
        where: { neonAuthId: userId },
        select: { id: true, email: true },
      });
      dbUserId = dbUser?.id ?? null;
      dbUserEmail = normalizeEmail(dbUser?.email ?? null);
    }

    const emailCandidates = Array.from(
      new Set([dbUserEmail, sessionEmail].filter((value): value is string => Boolean(value)))
    );
    const ownershipOr: Prisma.DriverApplicationWhereInput[] = [];
    if (dbUserId) ownershipOr.push({ userId: dbUserId });
    for (const email of emailCandidates) {
      ownershipOr.push({
        email: { equals: email, mode: 'insensitive' as const },
      });
    }

    if (ownershipOr.length === 0) {
      return NextResponse.json({ application: null });
    }

    const application = await prisma.driverApplication.findFirst({
      where: { OR: ownershipOr },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        city: true,
        vehicleType: true,
        fullName: true,
        email: true,
        phone: true,
        availability: true,
        whyOtwAnswer: true,
        message: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ application: serializeApplicationSummary(application) });
  } catch (error) {
    console.error('Driver application lookup error:', error);
    return new NextResponse('Unable to load application status', { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getNeonSession();
    const neonUserId = extractNeonAuthUserId(session);
    const sessionEmail = normalizeEmail(extractNeonAuthEmail(session));
    if (!neonUserId && !sessionEmail) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const prisma = getPrisma();
    let dbUserId: string | null = null;
    let dbUserEmail: string | null = null;
    if (neonUserId) {
      const dbUser = await prisma.user.findUnique({
        where: { neonAuthId: neonUserId },
        select: { id: true, email: true },
      });
      dbUserId = dbUser?.id ?? null;
      dbUserEmail = normalizeEmail(dbUser?.email ?? null);
    }

    const payload = await req.json().catch(() => ({}));
    const applicationId =
      payload && typeof payload.id === 'string' ? payload.id.trim() : '';

    const emailCandidates = Array.from(
      new Set([dbUserEmail, sessionEmail].filter((value): value is string => Boolean(value)))
    );
    const ownershipOr: Prisma.DriverApplicationWhereInput[] = [];
    if (dbUserId) ownershipOr.push({ userId: dbUserId });
    for (const email of emailCandidates) {
      ownershipOr.push({
        email: { equals: email, mode: 'insensitive' as const },
      });
    }

    if (ownershipOr.length === 0) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const existing = await prisma.driverApplication.findFirst({
      where: {
        ...(applicationId ? { id: applicationId } : {}),
        OR: ownershipOr,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, notes: true },
    });

    if (!existing) {
      return new NextResponse('Application not found', { status: 404 });
    }

    if (existing.status !== 'PENDING') {
      return new NextResponse('Only pending applications can be withdrawn.', { status: 409 });
    }

    const withdrawMarker = `[APPLICANT_WITHDREW ${new Date().toISOString()}]`;
    await prisma.driverApplication.update({
      where: { id: existing.id },
      data: {
        status: 'DENIED',
        notes: existing.notes ? `${existing.notes}\n${withdrawMarker}` : withdrawMarker,
      },
    });

    return NextResponse.json({ success: true, id: existing.id, status: 'DENIED' });
  } catch (error) {
    console.error('Driver application withdraw error:', error);
    return new NextResponse('Unable to withdraw application', { status: 500 });
  }
}
