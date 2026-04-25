const ZAPIER_TIMEOUT_MS = 1500;

export async function sendZapierWebhook(
  eventType: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;

  if (!webhookUrl) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[ZAPIER] Skipped sending '${eventType}' because ZAPIER_WEBHOOK_URL is not set.`);
    }
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: eventType,
        timestamp: new Date().toISOString(),
        data: payload,
      }),
      signal: AbortSignal.timeout(ZAPIER_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(
        `[ZAPIER] Webhook for event '${eventType}' failed with status ${response.status}.`
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error(`[ZAPIER] Failed to send webhook for event '${eventType}':`, error);
    return false;
  }
}
