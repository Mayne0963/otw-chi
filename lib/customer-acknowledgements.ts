import 'server-only';

import type { AutomationIntakePayload } from '@/lib/automation/intake';
import { sendTransactionalEmail } from '@/lib/email/transactional';

const OTW_TIME_ZONE = 'America/Indiana/Indianapolis';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeText(value?: string | null) {
  return typeof value === 'string' ? value.trim() : '';
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split(/[_\s-]+/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function formatScheduledFor(value?: string | Date | null) {
  if (!value) return 'Not scheduled';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not scheduled';

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: OTW_TIME_ZONE,
  }).format(date);
}

function buildHtmlMessage(title: string, intro: string, lines: string[]) {
  const paragraphs = [intro, ...lines].map((line) => `<p>${escapeHtml(line)}</p>`).join('');
  return `<!doctype html><html><body><h1>${escapeHtml(title)}</h1>${paragraphs}</body></html>`;
}

export function buildDeliveryRequestAcknowledgementPreview(input: {
  requestId: string;
  customerName?: string | null;
  serviceType: string;
  pickupAddress: string;
  dropoffAddress: string;
  scheduledFor?: string | Date | null;
  notes?: string | null;
}) {
  const subject = 'OTW Delivery Request Received';
  const intro = `We received your delivery request${input.customerName ? `, ${input.customerName}` : ''}. OTW will review the details and follow up if anything is needed before dispatch.`;
  const lines = [
    `Request ID: ${input.requestId}`,
    `Service Type: ${toTitleCase(input.serviceType)}`,
    `Pickup: ${normalizeText(input.pickupAddress) || 'Not provided'}`,
    `Dropoff: ${normalizeText(input.dropoffAddress) || 'Not provided'}`,
    `Scheduled For: ${formatScheduledFor(input.scheduledFor)}`,
    `Notes: ${normalizeText(input.notes) || 'None'}`,
  ];

  return {
    subject,
    text: [intro, '', ...lines].join('\n'),
    html: buildHtmlMessage(subject, intro, lines),
  };
}

export async function sendDeliveryRequestAcknowledgementEmail(input: {
  toEmail: string;
  customerName?: string | null;
  requestId: string;
  serviceType: string;
  pickupAddress: string;
  dropoffAddress: string;
  scheduledFor?: string | Date | null;
  notes?: string | null;
}) {
  const preview = buildDeliveryRequestAcknowledgementPreview(input);
  await sendTransactionalEmail({
    toEmail: input.toEmail,
    toName: input.customerName,
    subject: preview.subject,
    html: preview.html,
    text: preview.text,
  });
}

export function buildAutomationAcknowledgementPreview(payload: AutomationIntakePayload) {
  const subject = 'OTW Request Received';
  const intro = `We received your OTW request${payload.customerName ? `, ${payload.customerName}` : ''}. We'll review the details and get back to you before confirming next steps on our end.`;
  const lines =
    payload.businessType === 'otw'
      ? [
          `Service Type: ${payload.serviceType}`,
          `Pickup Address: ${payload.pickupAddress}`,
          `Dropoff Address: ${payload.dropoffAddress}`,
          `Quoted Price: $${payload.price.toFixed(2)}`,
          `Notes: ${payload.notes || 'None'}`,
        ]
      : [
          `Service Type: ${payload.serviceType}`,
          `Address: ${payload.address}`,
          `Quoted Price: $${payload.price.toFixed(2)}`,
          `Notes: ${payload.notes || 'None'}`,
        ];

  return {
    subject,
    text: [intro, '', ...lines].join('\n'),
    html: buildHtmlMessage(subject, intro, lines),
  };
}

export async function sendAutomationAcknowledgementEmail(payload: AutomationIntakePayload) {
  const preview = buildAutomationAcknowledgementPreview(payload);
  await sendTransactionalEmail({
    toEmail: payload.email,
    toName: payload.customerName,
    subject: preview.subject,
    html: preview.html,
    text: preview.text,
  });
}
