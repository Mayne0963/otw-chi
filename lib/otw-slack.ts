import 'server-only';

import type { AutomationIntakePayload } from '@/lib/automation/intake';
import { canSendSlackWebhook, getSlackWebhookUrl, postToSlackWebhook } from '@/lib/services/slack';

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

function formatUsd(amount: number | null | undefined) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatScheduledFor(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Indiana/Indianapolis',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function canSendSlackOtwRequestAlerts() {
  return canSendSlackWebhook('SLACK_OTW_REQUESTS_WEBHOOK_URL');
}

export function canSendSlackOtwIntakeAlerts() {
  return canSendSlackWebhook('SLACK_OTW_INTAKE_WEBHOOK_URL');
}

export function buildSlackOtwRequestAlert(input: {
  requestId: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  serviceType: string;
  pickupAddress: string;
  dropoffAddress: string;
  notes?: string | null;
  scheduledFor?: string | Date | null;
  paymentRequired: boolean;
  totalEstimated?: number | null;
}) {
  const lines = [
    '*NEW OTW REQUEST*',
    `*Request ID:* ${input.requestId}`,
    input.customerName ? `*Customer:* ${input.customerName}` : null,
    input.customerEmail ? `*Email:* ${input.customerEmail}` : null,
    input.customerPhone ? `*Phone:* ${input.customerPhone}` : null,
    `*Service Type:* ${toTitleCase(input.serviceType)}`,
    `*Pickup:* ${input.pickupAddress}`,
    `*Dropoff:* ${input.dropoffAddress}`,
    input.scheduledFor ? `*Scheduled For:* ${input.scheduledFor}` : null,
    `*Status:* ${input.paymentRequired ? 'Awaiting Payment' : 'New'}`,
    typeof input.totalEstimated === 'number'
      ? `*Estimated Total:* ${formatUsd(input.totalEstimated) ?? input.totalEstimated}`
      : null,
    normalizeText(input.notes) ? `*Notes:* ${normalizeText(input.notes)}` : null,
  ];

  return lines.filter((line): line is string => typeof line === 'string').join('\n');
}

export async function sendSlackOtwRequestAlert(input: {
  requestId: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  serviceType: string;
  pickupAddress: string;
  dropoffAddress: string;
  notes?: string | null;
  scheduledFor?: string | Date | null;
  paymentRequired: boolean;
  totalEstimated?: number | null;
}) {
  const webhookUrl = getSlackWebhookUrl('SLACK_OTW_REQUESTS_WEBHOOK_URL');
  if (!webhookUrl) {
    throw new Error('SLACK_OTW_REQUESTS_WEBHOOK_URL is not configured.');
  }

  await postToSlackWebhook({
    webhookUrl,
    text: buildSlackOtwRequestAlert({
      ...input,
      scheduledFor: formatScheduledFor(input.scheduledFor),
    }),
  });
}

export function buildSlackOtwAutomationAlert(input: {
  requestId: string;
  payload: AutomationIntakePayload;
}) {
  const common = [
    '*NEW OTW INTAKE REQUEST*',
    `*Request ID:* ${input.requestId}`,
    `*Customer:* ${input.payload.customerName}`,
    `*Email:* ${input.payload.email}`,
    `*Phone:* ${input.payload.phone}`,
    `*Service Type:* ${input.payload.serviceType}`,
    `*Quoted Price:* ${formatUsd(input.payload.price) ?? input.payload.price}`,
    `*Source:* ${input.payload.source}`,
  ];

  if (input.payload.businessType === 'otw') {
    return [
      ...common,
      `*Pickup:* ${input.payload.pickupAddress}`,
      `*Dropoff:* ${input.payload.dropoffAddress}`,
      normalizeText(input.payload.notes) ? `*Notes:* ${input.payload.notes}` : null,
    ]
      .filter((line): line is string => typeof line === 'string')
      .join('\n');
  }

  return [
    ...common,
    `*Address:* ${input.payload.address}`,
    normalizeText(input.payload.notes) ? `*Notes:* ${input.payload.notes}` : null,
  ]
    .filter((line): line is string => typeof line === 'string')
    .join('\n');
}

export async function sendSlackOtwAutomationAlert(input: {
  requestId: string;
  payload: AutomationIntakePayload;
}) {
  const webhookUrl = getSlackWebhookUrl('SLACK_OTW_INTAKE_WEBHOOK_URL');
  if (!webhookUrl) {
    throw new Error('SLACK_OTW_INTAKE_WEBHOOK_URL is not configured.');
  }

  await postToSlackWebhook({
    webhookUrl,
    text: buildSlackOtwAutomationAlert(input),
  });
}
