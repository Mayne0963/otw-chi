const ZAPIER_TIMEOUT_MS = 5000;

function isValidZapierWebhookUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
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
    if (process.env.NODE_ENV !== 'production') {
      console.log(
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
    const body = JSON.stringify({
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload,
    });

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
