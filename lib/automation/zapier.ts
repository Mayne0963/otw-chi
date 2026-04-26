import {
  buildZapierAutomationRecord,
  type AutomationIntakePayload,
} from '@/lib/automation/intake';

const ZAPIER_AUTOMATION_TIMEOUT_MS = 5000;
const ZAPIER_AUTOMATION_MAX_ATTEMPTS = 2;
const ZAPIER_RETRY_DELAY_MS = 250;
const ZAPIER_URL_PREFIX = 'https://hooks.zapier.com/hooks/catch/';
const TRANSIENT_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

export type SendAutomationToZapierResult =
  | { ok: true; status: number }
  | {
      ok: false;
      code: 'MISSING_WEBHOOK_URL' | 'INVALID_WEBHOOK_URL' | 'ZAPIER_REJECTED' | 'ZAPIER_UNAVAILABLE';
      message: string;
      status?: number;
    };

function getWebhookUrl() {
  const webhookUrl = process.env.ZAPIER_WEBHOOK_URL?.trim();
  return webhookUrl && webhookUrl.length > 0 ? webhookUrl : null;
}

function isValidZapierWebhookUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && value.startsWith(ZAPIER_URL_PREFIX);
  } catch {
    return false;
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendAutomationIntakeToZapier(
  payload: AutomationIntakePayload,
  context: { requestId: string; submittedAt: string },
): Promise<SendAutomationToZapierResult> {
  const webhookUrl = getWebhookUrl();

  if (!webhookUrl) {
    console.error('[AUTOMATION] ZAPIER_WEBHOOK_URL is not configured.');
    return {
      ok: false,
      code: 'MISSING_WEBHOOK_URL',
      message: 'Zapier webhook URL is not configured.',
    };
  }

  if (!isValidZapierWebhookUrl(webhookUrl)) {
    console.error('[AUTOMATION] Invalid ZAPIER_WEBHOOK_URL configured.');
    return {
      ok: false,
      code: 'INVALID_WEBHOOK_URL',
      message: 'Zapier webhook URL is invalid.',
    };
  }

  const body = JSON.stringify(buildZapierAutomationRecord(payload, context));

  for (let attempt = 1; attempt <= ZAPIER_AUTOMATION_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ZAPIER_AUTOMATION_TIMEOUT_MS);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });

      if (response.ok) {
        return { ok: true, status: response.status };
      }

      let responseText = '';
      try {
        responseText = (await response.text()).slice(0, 300);
      } catch {
        responseText = '';
      }

      if (attempt < ZAPIER_AUTOMATION_MAX_ATTEMPTS && TRANSIENT_STATUS_CODES.has(response.status)) {
        await wait(ZAPIER_RETRY_DELAY_MS);
        continue;
      }

      console.error(
        `[AUTOMATION] Zapier rejected ${context.requestId} with ${response.status}${
          responseText ? `: ${responseText}` : ''
        }`,
      );
      return {
        ok: false,
        code: 'ZAPIER_REJECTED',
        message: 'Zapier rejected the request.',
        status: response.status,
      };
    } catch (error) {
      if (attempt < ZAPIER_AUTOMATION_MAX_ATTEMPTS) {
        await wait(ZAPIER_RETRY_DELAY_MS);
        continue;
      }

      console.error(`[AUTOMATION] Failed sending ${context.requestId} to Zapier:`, error);
      return {
        ok: false,
        code: 'ZAPIER_UNAVAILABLE',
        message: 'Zapier did not respond in time.',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    ok: false,
    code: 'ZAPIER_UNAVAILABLE',
    message: 'Zapier did not respond in time.',
  };
}
