export async function sendZapierWebhook(eventType: string, payload: Record<string, any>) {
  const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
  
  if (!webhookUrl) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[ZAPIER] Skipped sending '${eventType}' because ZAPIER_WEBHOOK_URL is not set.`);
    }
    return;
  }

  try {
    // Fire and forget so we don't block the main API response
    fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: eventType,
        timestamp: new Date().toISOString(),
        data: payload,
      }),
    }).catch(err => {
      console.error(`[ZAPIER] Async fetch failed for event '${eventType}':`, err);
    });
  } catch (error) {
    console.error(`[ZAPIER] Failed to initiate webhook for event '${eventType}':`, error);
  }
}
