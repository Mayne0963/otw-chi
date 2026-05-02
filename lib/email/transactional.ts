import 'server-only';

function normalizeText(value?: string | null) {
  return typeof value === 'string' ? value.trim() : '';
}

export function getDefaultFromEmail() {
  return normalizeText(process.env.FROM_EMAIL) || 'onboarding@resend.dev';
}

export function getDefaultFromName() {
  return normalizeText(process.env.FROM_NAME) || 'OTW';
}

export function canSendTransactionalEmails() {
  return Boolean(normalizeText(process.env.RESEND_API_KEY));
}

export async function sendTransactionalEmail(input: {
  toEmail: string;
  toName?: string | null;
  subject: string;
  html: string;
  text: string;
}) {
  const apiKey = normalizeText(process.env.RESEND_API_KEY);
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: `${getDefaultFromName()} <${getDefaultFromEmail()}>`,
      to: [input.toEmail],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  const responseText = await response.text().catch(() => '');
  if (!response.ok) {
    throw new Error(responseText || `Resend email request failed with status ${response.status}`);
  }
}
