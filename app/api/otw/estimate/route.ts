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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const formData = new FormData();
    
    // Convert query params to form data for compatibility
    const pickup = searchParams.get('pickup');
    const dropoff = searchParams.get('dropoff');
    const serviceType = searchParams.get('serviceType');
    const miles = searchParams.get('miles');
    
    if (pickup) formData.set('pickup', pickup);
    if (dropoff) formData.set('dropoff', dropoff);
    if (serviceType) formData.set('serviceType', serviceType);
    if (miles) formData.set('miles', miles);
    
    const result = await getEstimateAction(formData);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API estimate GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed to estimate' }, { status: 400 });
  }
}