import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const digest = typeof payload.digest === 'string' ? payload.digest : null;
    const message = typeof payload.message === 'string' ? payload.message : null;
    const name = typeof payload.name === 'string' ? payload.name : null;
    const stack = typeof payload.stack === 'string' ? payload.stack : null;
    const href = typeof payload.href === 'string' ? payload.href : null;

    console.error('[client-error]', {
      digest,
      name,
      message,
      href,
      stack,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

