import { NextResponse } from 'next/server';

import {
  automationIntakeSchema,
  formatAutomationValidationErrors,
  getAutomationConfirmationMessage,
} from '@/lib/automation/intake';
import {
  markAutomationIntakeZapierDelivered,
  markAutomationIntakeZapierFailed,
  persistAutomationIntakeRecord,
} from '@/lib/automation/storage';
import { sendAutomationIntakeToZapier } from '@/lib/automation/zapier';
import { canSendTransactionalEmails } from '@/lib/email/transactional';
import { sendAutomationAcknowledgementEmail } from '@/lib/customer-acknowledgements';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 20_000;

function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `automation_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { ok: false, error: 'PAYLOAD_TOO_LARGE', message: 'Request is too large.' },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'INVALID_JSON', message: 'Request body must be valid JSON.' },
      { status: 400 },
    );
  }

  const parsed = automationIntakeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'VALIDATION_ERROR',
        message: 'Please check the required fields and try again.',
        fieldErrors: formatAutomationValidationErrors(parsed.error),
      },
      { status: 422 },
    );
  }

  const requestId = createRequestId();
  const submittedAt = new Date().toISOString();
  await persistAutomationIntakeRecord(parsed.data, { requestId, submittedAt });
  const zapierResult = await sendAutomationIntakeToZapier(parsed.data, { requestId, submittedAt });

  if (!zapierResult.ok) {
    await markAutomationIntakeZapierFailed(requestId, zapierResult);
    return NextResponse.json(
      {
        ok: false,
        error: 'AUTOMATION_UNAVAILABLE',
        message: 'We could not submit your request right now. Please try again in a minute.',
      },
      { status: zapierResult.code === 'MISSING_WEBHOOK_URL' ? 503 : 502 },
    );
  }

  await markAutomationIntakeZapierDelivered(requestId, zapierResult.status);

  if (parsed.data.businessType === 'otw' && canSendTransactionalEmails()) {
    try {
      await sendAutomationAcknowledgementEmail(parsed.data);
    } catch (emailError) {
      console.error('[OTW AUTOMATION INTAKE] Failed to send customer acknowledgment email:', emailError);
    }
  }

  return NextResponse.json({
    ok: true,
    id: requestId,
    message: getAutomationConfirmationMessage(parsed.data),
  });
}
