import { NextResponse } from 'next/server';
import { analyzeReceiptFile, MAX_RECEIPT_BYTES } from '@/lib/receipts/analyzer';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Receipt image is required.' }, { status: 400 });
    }

    if (file.size > MAX_RECEIPT_BYTES) {
      return NextResponse.json({ error: 'Receipt is too large. Please upload a smaller image.' }, { status: 413 });
    }

    const restaurantName = formData.get('restaurantName')?.toString();
    const restaurantWebsite = formData.get('restaurantWebsite')?.toString();
    const pickupAddress = formData.get('pickupAddress')?.toString();
    const dropoffAddress = formData.get('dropoffAddress')?.toString();

    const analysis = await analyzeReceiptFile(file, {
      restaurantName,
      restaurantWebsite,
      pickupAddress,
      dropoffAddress,
    });

    return NextResponse.json({
      vendorName: analysis.vendorName,
      location: analysis.location,
      items: analysis.items,
      authenticityScore: analysis.authenticityScore,
      authenticityReason: analysis.authenticityReason,
      hash: analysis.hash,
      subtotalCents: analysis.subtotalCents,
      imageData: analysis.imageData,
    });
  } catch (error) {
    console.error('Receipt analysis error:', error);
    return NextResponse.json(
      { error: 'Unable to analyze that receipt. Please try a clearer image.' },
      { status: 400 }
    );
  }
}
