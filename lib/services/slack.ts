import 'server-only';

type SlackWebhookEnvKey =
  | 'SLACK_OTW_REQUESTS_WEBHOOK_URL'
  | 'SLACK_OTW_INTAKE_WEBHOOK_URL';

function normalizeText(value?: string | null) {
  return typeof value === 'string' ? value.trim() : '';
}

export function getSlackWebhookUrl(key: SlackWebhookEnvKey) {
  return normalizeText(process.env[key]);
}

export function canSendSlackWebhook(key: SlackWebhookEnvKey) {
  return Boolean(getSlackWebhookUrl(key));
}

export async function postToSlackWebhook(input: { webhookUrl: string; text: string }) {
  const response = await fetch(input.webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: input.text }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(body || `Slack webhook request failed with status ${response.status}`);
  }
}
