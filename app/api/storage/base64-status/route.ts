import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { getPickupPassBase64CircuitStatus } from '@/lib/pickup-pass';
import { isStorageConfigured } from '@/lib/storage';

export async function GET() {
  const base64Mode = !isStorageConfigured();

  if (!base64Mode) {
    return NextResponse.json(
      {
        base64Mode: false,
        uploadsAllowed: true,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }

  const prisma = getPrisma();
  const status = await getPickupPassBase64CircuitStatus(prisma, true);

  return NextResponse.json(
    {
      base64Mode: true,
      uploadsAllowed: status.uploadsAllowed,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
