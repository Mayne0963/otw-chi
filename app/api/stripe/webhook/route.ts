import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ success: false, error: 'Webhook not configured' }, { status: 501 });
  }
  // TODO: validate signature and handle events
  return NextResponse.json({ success: true }, { status: 200 });
}

