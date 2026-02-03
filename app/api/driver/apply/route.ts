import { NextResponse } from 'next/server';
import { getNeonSession } from '@/lib/auth/server';
import { getPrisma } from '@/lib/db';
import { z } from 'zod';

const applicationSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  city: z.string().min(2),
  vehicleType: z.string().min(2),
  availability: z.string().optional(),
  message: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getNeonSession();
    // @ts-ignore
    const userId = session?.userId || session?.user?.id;
    
    const prisma = getPrisma();
    
    // Check if user already applied
    if (userId) {
        const user = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (user) {
            const existing = await prisma.driverApplication.findFirst({
                where: { userId: user.id, status: 'PENDING' }
            });
            if (existing) {
                return new NextResponse('You already have a pending application.', { status: 409 });
            }
        }
    }

    const body = await req.json();
    const data = applicationSchema.parse(body);
    
    let dbUserId = null;
    if (userId) {
        const user = await prisma.user.findUnique({ where: { clerkId: userId } });
        dbUserId = user?.id;
    }

    await prisma.driverApplication.create({
      data: {
        userId: dbUserId || undefined,
        email: data.email,
        fullName: data.fullName,
        phone: data.phone,
        city: data.city,
        vehicleType: data.vehicleType,
        availability: data.availability,
        message: data.message,
        notes: data.message,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Driver application error:', error);
    return new NextResponse('Invalid application data', { status: 400 });
  }
}
