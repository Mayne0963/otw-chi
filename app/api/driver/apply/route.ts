import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';
import { z } from 'zod';

const applicationSchema = z.object({
  fullName: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(10, "Phone number is required"),
  city: z.string().min(2, "City is required"),
  vehicleType: z.string().min(2, "Vehicle type is required"),
  availability: z.string().min(2, "Availability is required"),
  message: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    const body = await req.json();
    const result = applicationSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() }, 
        { status: 400 }
      );
    }

    const prisma = getPrisma();
    let dbUserId: string | null = null;

    if (userId) {
      const user = await prisma.user.findUnique({ where: { clerkId: userId } });
      if (user) dbUserId = user.id;
    }

    const application = await prisma.driverApplication.create({
      data: {
        userId: dbUserId,
        ...result.data,
        status: 'NEW',
      },
    });

    return NextResponse.json(application, { status: 201 });
  } catch (error) {
    console.error('Driver application error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
