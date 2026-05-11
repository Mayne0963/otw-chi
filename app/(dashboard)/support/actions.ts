'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';

async function tryCreateSupportAnalyticsEvent(input: {
  sessionId: string;
  userId: string;
  page: string;
  action: 'create_ticket' | 'reply_ticket';
  ticketId?: string;
}) {
  const sessionId = input.sessionId.trim();
  if (sessionId.length < 8) return;

  const prisma = getPrisma();
  const customerProfile = await prisma.customerProfile
    .findUnique({ where: { userId: input.userId }, select: { id: true } })
    .catch(() => null);

  await prisma.otwSiteEvent
    .create({
      data: {
        sessionId,
        userId: input.userId,
        customerProfileId: customerProfile?.id ?? undefined,
        eventType: 'CONTACT_SUBMITTED',
        page: input.page,
        metadata: {
          kind: 'support',
          action: input.action,
          ticketIdSuffix: input.ticketId ? input.ticketId.slice(-8) : null,
        },
      },
    })
    .catch(() => null);
}

function buildCustomerMessage(existingMessage: string | null, message: string) {
  const trimmedExisting = existingMessage?.trim() ?? '';
  const trimmedReply = message.trim();
  const stamp = `[Customer message • ${new Date().toISOString()}]`;

  if (!trimmedExisting) {
    return `${stamp}\n${trimmedReply}`;
  }

  return `${trimmedExisting}\n\n${stamp}\n${trimmedReply}`;
}

function revalidateSupportPaths(ticketId?: string) {
  revalidatePath('/support');
  revalidatePath('/admin/support');
  if (ticketId) {
    revalidatePath(`/support/${ticketId}`);
    revalidatePath(`/admin/support/${ticketId}`);
  }
}

export async function createTicketAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const sessionId = String(formData.get('otwSessionId') ?? '').trim();
  const subject = String(formData.get('subject') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();
  if (!subject || !message) return;

  const prisma = getPrisma();
  const created = await prisma.supportTicket.create({
    data: {
      userId: user.id,
      subject,
      message: buildCustomerMessage(null, message),
      status: 'OPEN',
    },
    select: { id: true },
  });

  void tryCreateSupportAnalyticsEvent({
    sessionId,
    userId: user.id,
    page: '/support',
    action: 'create_ticket',
    ticketId: created.id,
  });

  revalidateSupportPaths(created.id);
}

export async function replyToOwnTicketAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const sessionId = String(formData.get('otwSessionId') ?? '').trim();
  const id = String(formData.get('id') ?? '').trim();
  const reply = String(formData.get('reply') ?? '').trim();
  if (!id || !reply) return;

  const prisma = getPrisma();
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id,
      userId: user.id,
    },
    select: {
      id: true,
      message: true,
      status: true,
    },
  });

  if (!ticket) return;
  if (ticket.status !== 'OPEN') return;

  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: {
      message: buildCustomerMessage(ticket.message, reply),
      status: 'OPEN',
    },
  });

  void tryCreateSupportAnalyticsEvent({
    sessionId,
    userId: user.id,
    page: `/support/${ticket.id}`,
    action: 'reply_ticket',
    ticketId: ticket.id,
  });

  revalidateSupportPaths(ticket.id);
}
