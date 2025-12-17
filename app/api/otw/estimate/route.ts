import { NextRequest, NextResponse } from 'next/server';
import { getEstimateAction } from '@/app/actions/estimate';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const result = await getEstimateAction(formData);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API estimate error:', error);
    return NextResponse.json({ error: error.message || 'Failed to estimate' }, { status: 400 });
  }
}
