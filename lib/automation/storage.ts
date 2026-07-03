import { getPrisma } from '@/lib/db';
import {
  buildAutomationStorageRecord,
  type AutomationIntakePayload,
} from '@/lib/automation/intake';
import type { SendAutomationToZapierResult } from '@/lib/automation/zapier';

export async function persistAutomationIntakeRecord(
  payload: AutomationIntakePayload,
  context: { requestId: string; submittedAt: string },
) {
  const prisma = getPrisma();
  const record = buildAutomationStorageRecord(payload, context);

  await prisma.automationIntakeSubmission.upsert({
    where: { id: record.id },
    update: record,
    create: record,
  });
}

export async function markAutomationIntakeZapierDelivered(
  requestId: string,
  statusCode: number,
) {
  const prisma = getPrisma();

  await prisma.automationIntakeSubmission.update({
    where: { id: requestId },
    data: {
      zapierLastAttemptAt: new Date(),
      zapierDeliveredAt: new Date(),
      zapierStatusCode: statusCode,
      zapierErrorCode: null,
      zapierErrorMessage: null,
    },
  });
}

export async function markAutomationIntakeZapierFailed(
  requestId: string,
  result: Extract<SendAutomationToZapierResult, { ok: false }>,
) {
  const prisma = getPrisma();

  await prisma.automationIntakeSubmission.update({
    where: { id: requestId },
    data: {
      zapierLastAttemptAt: new Date(),
      zapierDeliveredAt: null,
      zapierStatusCode: result.status ?? null,
      zapierErrorCode: result.code,
      zapierErrorMessage: result.message,
    },
  });
}
