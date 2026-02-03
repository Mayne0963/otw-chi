import { NextRequest, NextResponse } from 'next/server';
import { getNeonSession } from '@/lib/auth/server';
import { getPrisma } from '@/lib/db';

export async function GET(
  req: NextRequest,
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
    
    // Get user from DB to check permissions
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const request = await prisma.request.findUnique({
      where: { id },
      include: {
        assignedDriver: {
          include: { user: true }
        },
        events: { orderBy: { timestamp: 'desc' } }
      }
    });

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Auth check
    const isOwner = request.customerId === user.id;
    const isDriver = request.assignedDriver?.userId === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isDriver && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(request);
  } catch (error) {
    console.error('Get request details error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
