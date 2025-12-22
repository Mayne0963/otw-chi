import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';
import { z } from 'zod';

const schema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7),
  city: z.string().min(2),
  vehicleType: z.string().min(2),
  availability: z.string().min(2),
  message: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const prisma = getPrisma();
    const { userId } = await auth();

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    let dbUserId: string | undefined;
    if (userId) {
      const dbUser = await prisma.user.findFirst({ where: { clerkId: userId } });
      dbUserId = dbUser?.id;
    }

    const application = await prisma.driverApplication.create({
      data: {
        userId: dbUserId,
        email: data.email,
        fullName: data.fullName,
        phone: data.phone,
        city: data.city,
        vehicleType: data.vehicleType,
        availability: data.availability,
        message: data.message || null,
        status: 'pending',
      },
    });

    return NextResponse.json(application, { status: 201 });
  } catch (error) {
    console.error('Driver apply error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

