import { NextResponse } from 'next/server';
import { CreateRequestSchema } from '@/lib/validation/request';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = CreateRequestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 });
    }
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const prisma = getPrisma();
    const created = await prisma.request.create({
      data: {
        pickup: parsed.data.pickup,
        dropoff: parsed.data.dropoff,
        serviceType: parsed.data.serviceType,
        notes: parsed.data.notes,
        status: 'DRAFT',
        customerId: user.id,
      }
    });
    return NextResponse.json({ success: true, request: created }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
