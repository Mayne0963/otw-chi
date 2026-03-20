import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { getPrisma } from '@/lib/db';

function buildSupportReplyMessage(existingMessage: string | null, reply: string) {
  const trimmedExisting = existingMessage?.trim() ?? '';
  const trimmedReply = reply.trim();
  const stamp = `[Support reply • ${new Date().toISOString()}]`;

  if (!trimmedExisting) {
    return `${stamp}\n${trimmedReply}`;
  }

  return `${trimmedExisting}\n\n${stamp}\n${trimmedReply}`;
}

function revalidateSupportPaths(ticketId: string) {
  revalidatePath('/admin/support');
  revalidatePath(`/admin/support/${ticketId}`);
  revalidatePath('/support');
}

export async function resolveTicketAction(formData: FormData) {
  'use server';
  await requireRole(['ADMIN']);
  const id = String(formData.get('id') ?? '').trim();

  if (!id) {
    return;
  }

  const prisma = getPrisma();
  await prisma.supportTicket.update({
    where: { id },
    data: { status: 'RESOLVED' },
  });

  revalidateSupportPaths(id);
}

export async function closeTicketAction(formData: FormData) {
  'use server';
  await requireRole(['ADMIN']);
  const id = String(formData.get('id') ?? '').trim();

  if (!id) {
    return;
  }

  const prisma = getPrisma();
  await prisma.supportTicket.update({
    where: { id },
    data: { status: 'CLOSED' },
  });

  revalidateSupportPaths(id);
}

export async function reopenTicketAction(formData: FormData) {
  'use server';
  await requireRole(['ADMIN']);
  const id = String(formData.get('id') ?? '').trim();

  if (!id) {
    return;
  }

  const prisma = getPrisma();
  await prisma.supportTicket.update({
    where: { id },
    data: { status: 'OPEN' },
  });

  revalidateSupportPaths(id);
}

export async function replyToTicketAction(formData: FormData) {
  'use server';
  await requireRole(['ADMIN']);
  const id = String(formData.get('id') ?? '').trim();
  const reply = String(formData.get('reply') ?? '').trim();

  if (!id || !reply) {
    return;
  }

  const prisma = getPrisma();
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: { id: true, message: true },
  });

  if (!ticket) {
    return;
  }

  const updatedMessage = buildSupportReplyMessage(ticket.message, reply);

  await prisma.supportTicket.update({
    where: { id },
    data: {
      message: updatedMessage,
      status: 'OPEN',
    },
  });

  revalidateSupportPaths(id);
}
