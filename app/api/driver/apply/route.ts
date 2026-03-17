import { NextResponse } from 'next/server';
import { extractNeonAuthUserId, getNeonSession } from '@/lib/auth/server';
import { getPrisma } from '@/lib/db';
import { z } from 'zod';

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

export async function POST(req: Request) {
  try {
    const session = await getNeonSession();
    const userId = extractNeonAuthUserId(session);

    const prisma = getPrisma();

    const body = await req.json();
    const data = applicationSchema.parse(body);

    let dbUserId: string | null = null;
    if (userId) {
      const user = await prisma.user.findUnique({ where: { neonAuthId: userId } });
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
        where: { userId: dbUserId, status: 'PENDING' },
      });
      if (existingByUser) {
        return new NextResponse('You already have a pending application.', { status: 409 });
      }
    }

    // Prevent duplicate pending applications by email (including guests).
    const existingByEmail = await prisma.driverApplication.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
        status: 'PENDING',
      },
      select: { id: true },
    });
    if (existingByEmail) {
      return new NextResponse('An application with this email is already pending review.', { status: 409 });
    }

    await prisma.driverApplication.create({
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
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Driver application error:', error);
    return new NextResponse('Invalid application data', { status: 400 });
  }
}
