const ZAPIER_TIMEOUT_MS = 5000;
let loggedMissingWebhookUrl = false;

function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `zapier_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function isValidZapierWebhookUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function normalizeBusinessType(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'broskis') return 'broski';
  return normalized;
}

function getOrderSourceLabel(businessType: string) {
  const normalized = normalizeBusinessType(businessType);
  if (normalized === 'otw') return 'OTW';
  if (normalized === 'broski') return 'Broskis';
  return businessType;
}

function buildZapierRecord(eventType: string, payload: Record<string, unknown>) {
  const suppliedRequestId = typeof payload.requestId === 'string' ? payload.requestId.trim() : '';
  const requestId = suppliedRequestId.length > 0 ? suppliedRequestId : createRequestId();

  const suppliedSubmittedAt = typeof payload.submittedAt === 'string' ? payload.submittedAt.trim() : '';
  const submittedAt = suppliedSubmittedAt.length > 0 ? suppliedSubmittedAt : new Date().toISOString();

  const suppliedBusinessType = typeof payload.businessType === 'string' ? payload.businessType.trim() : '';
  const businessType = suppliedBusinessType.length > 0 ? normalizeBusinessType(suppliedBusinessType) : undefined;
  const orderSource = businessType ? getOrderSourceLabel(businessType) : undefined;

  const cleaned: Record<string, unknown> = { ...payload };
  delete cleaned.requestId;
  delete cleaned.submittedAt;
  delete cleaned.businessType;
  delete cleaned.orderSource;
  // Guard against callers accidentally passing the legacy envelope keys.
  delete cleaned.event;
  delete cleaned.timestamp;
  delete cleaned.data;

  return {
    event: eventType,
    requestId,
    submittedAt,
    ...(businessType ? { businessType } : {}),
    ...(orderSource ? { orderSource } : {}),
    ...cleaned,
  };
}

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

export async function sendZapierWebhook(
  eventType: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const webhookUrls = getWebhookUrls();

  if (webhookUrls.length === 0) {
    if (!loggedMissingWebhookUrl) {
      loggedMissingWebhookUrl = true;
      console.error(
        `[ZAPIER] Skipped sending '${eventType}' because ZAPIER_WEBHOOK_URL (or ZAPIER_WEBHOOK_URLS) is not set.`,
      );
    }
    return false;
  }

  const invalidUrls = webhookUrls.filter((url) => !isValidZapierWebhookUrl(url));
  if (invalidUrls.length > 0) {
    console.error(
      `[ZAPIER] Invalid Zapier webhook URL(s) configured: ${invalidUrls.join(
        ', ',
      )}. Event '${eventType}' was not sent.`,
    );
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ZAPIER_TIMEOUT_MS);

  try {
    const body = JSON.stringify(buildZapierRecord(eventType, payload));

    const results = await Promise.allSettled(
      webhookUrls.map(async (webhookUrl) => {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body,
        });

        return { webhookUrl, response };
      }),
    );

    let allOk = true;

    for (const result of results) {
      if (result.status === 'rejected') {
        allOk = false;
        console.error(`[ZAPIER] Failed sending webhook for event '${eventType}':`, result.reason);
        continue;
      }

      const { webhookUrl, response } = result.value;
      if (response.ok) {
        continue;
      }

      allOk = false;
      let responseText = '';
      try {
        responseText = (await response.text()).slice(0, 300);
      } catch {
        responseText = '';
      }

      console.error(
        `[ZAPIER] Webhook for '${eventType}' (${webhookUrl}) returned ${response.status}${
          responseText ? `: ${responseText}` : ''
        }`,
      );
    }

    return allOk;
  } catch (error) {
    console.error(`[ZAPIER] Failed to send webhook for event '${eventType}':`, error);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
