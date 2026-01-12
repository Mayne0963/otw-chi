import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';

export async function POST(_request: Request) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prisma = getPrisma();
    
    // Get the user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can use this endpoint' }, { status: 403 });
    }

    // Ensure customer profile exists
    const customerProfile = await prisma.customerProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });

    // Ensure driver profile exists
    const driverProfile = await prisma.driverProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { 
        userId: user.id,
        status: 'OFFLINE',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Admin profiles set up successfully',
      data: {
        userId: user.id,
        role: user.role,
        customerProfileId: customerProfile.id,
        driverProfileId: driverProfile.id,
      },
    });
  } catch (error) {
    console.error('[Setup Profiles] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: String(error),
      },
      { status: 500 }
    );
  }
}
