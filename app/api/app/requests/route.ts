import { NextResponse } from 'next/server';
import { CreateRequestSchema } from '@/lib/validation/request';
import { getPrisma } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = CreateRequestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 });
    }
    const prisma = getPrisma();
    const created = await prisma.request.create({
      data: {
        pickup: parsed.data.pickup,
        dropoff: parsed.data.dropoff,
        serviceType: parsed.data.serviceType,
        notes: parsed.data.notes,
        status: 'DRAFT',
        customerId: 'TEMP-CUSTOMER', // TODO: replace with real user id from auth
      }
    });
    return NextResponse.json({ success: true, request: created }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message ?? 'Server error' }, { status: 500 });
  }
}

