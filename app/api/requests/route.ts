import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';
import { z } from 'zod';
import { ServiceType } from '@prisma/client';

const requestSchema = z.object({
  pickup: z.string().min(5),
  dropoff: z.string().min(5),
  serviceType: z.enum(['FOOD', 'STORE', 'FRAGILE', 'CONCIERGE']),
  notes: z.string().optional(),
  costEstimate: z.number().int().positive(),
  milesEstimate: z.number().positive(),
});

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
        return new NextResponse('Unauthorized', { status: 401 });
    }
    
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId } });
    
    if (!user) {
        return new NextResponse('User not found', { status: 404 });
    }

    const body = await req.json();
    const data = requestSchema.parse(body);

    const request = await prisma.request.create({
      data: {
        customerId: user.id,
        pickup: data.pickup,
        dropoff: data.dropoff,
        serviceType: data.serviceType as ServiceType,
        notes: data.notes,
        status: 'SUBMITTED',
        costEstimate: data.costEstimate,
        milesEstimate: data.milesEstimate,
      },
    });

    return NextResponse.json({ id: request.id });
  } catch (error) {
    console.error('Create request error:', error);
    return new NextResponse('Invalid request', { status: 400 });
  }
}
