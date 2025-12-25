import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const miles = Number(formData.get('miles')) || 1;
    
    // Simple pricing logic: $5 base + $1.50/mile (in cents)
    const basePrice = 500 + (miles * 150); 
    
    return NextResponse.json({
      basePrice,
      discountedPrice: basePrice, 
      miles
    });
  } catch (error) {
    console.error('Estimate error:', error);
    return new NextResponse('Invalid request', { status: 400 });
  }
}
