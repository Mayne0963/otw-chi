'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';

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

  revalidateSupportPaths(created.id);
}

export async function replyToOwnTicketAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

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

  revalidateSupportPaths(ticket.id);
}
