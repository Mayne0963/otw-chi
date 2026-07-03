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

function parseWebhookUrlList(value: string | undefined) {
  if (!value) return [];

  return value
    .split(/[,\n]/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getWebhookUrls() {
  const urlsFromList = parseWebhookUrlList(process.env.ZAPIER_WEBHOOK_URLS);
  if (urlsFromList.length > 0) {
    return urlsFromList;
  }

  const single = process.env.ZAPIER_WEBHOOK_URL?.trim();
  return single ? [single] : [];
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

async function sendToZapierWithRetry(
  webhookUrl: string,
  body: string,
  context: { requestId: string },
): Promise<Exclude<SendAutomationToZapierResult, { ok: false; code: 'MISSING_WEBHOOK_URL' | 'INVALID_WEBHOOK_URL' }>> {
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
        `[AUTOMATION] Zapier rejected ${context.requestId} (${webhookUrl}) with ${response.status}${
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

      console.error(`[AUTOMATION] Failed sending ${context.requestId} (${webhookUrl}) to Zapier:`, error);
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

export async function sendAutomationIntakeToZapier(
  payload: AutomationIntakePayload,
  context: { requestId: string; submittedAt: string },
): Promise<SendAutomationToZapierResult> {
  const webhookUrls = getWebhookUrls();

  if (webhookUrls.length === 0) {
    console.error('[AUTOMATION] ZAPIER_WEBHOOK_URL (or ZAPIER_WEBHOOK_URLS) is not configured.');
    return {
      ok: false,
      code: 'MISSING_WEBHOOK_URL',
      message: 'Zapier webhook URL is not configured.',
    };
  }

  const invalidUrls = webhookUrls.filter((url) => !isValidZapierWebhookUrl(url));
  if (invalidUrls.length > 0) {
    console.error(`[AUTOMATION] Invalid Zapier webhook URL(s) configured: ${invalidUrls.join(', ')}.`);
    return {
      ok: false,
      code: 'INVALID_WEBHOOK_URL',
      message: 'Zapier webhook URL is invalid.',
    };
  }

  const body = JSON.stringify(buildZapierAutomationRecord(payload, context));

  let firstStatus = 200;

  for (const webhookUrl of webhookUrls) {
    const result = await sendToZapierWithRetry(webhookUrl, body, context);
    if (!result.ok) {
      return result;
    }
    firstStatus = result.status;
  }

  return { ok: true, status: firstStatus };
}
