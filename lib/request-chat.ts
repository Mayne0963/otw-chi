import { DeliveryRequestStatus, Prisma, PrismaClient, Role } from '@prisma/client';

export const DRIVER_ASSIGNED_CHAT_OPEN_MESSAGE = 'Driver assigned. Chat is open.';
export const DELIVERED_CHAT_CLOSED_MESSAGE = 'Delivered. Chat is now closed.';

export type ChatGateRequest = {
  id: string;
  userId: string;
  assignedDriverId: string | null;
  status: DeliveryRequestStatus;
  chatEnabled: boolean;
  chatClosedAt: Date | null;
  assignedDriver: { userId: string } | null;
};

export type ChatParticipant = {
  id: string;
  role: Role;
};

type RequestChatDbClient = Prisma.TransactionClient | PrismaClient;

export function isRequestParticipant(
  request: ChatGateRequest,
  participant: ChatParticipant,
): boolean {
  if (participant.role === Role.ADMIN) {
    return true;
  }

  if (request.userId === participant.id) {
    return true;
  }

  if (request.assignedDriver?.userId === participant.id) {
    return true;
  }

  return false;
}

export function isRequestChatOpen(request: Pick<
  ChatGateRequest,
  'assignedDriverId' | 'status' | 'chatClosedAt' | 'chatEnabled'
>): boolean {
  if (!request.assignedDriverId) {
    return false;
  }

  if (!request.chatEnabled) {
    return false;
  }

  if (request.chatClosedAt) {
    return false;
  }

  if (request.status === DeliveryRequestStatus.DELIVERED || request.status === DeliveryRequestStatus.CANCELED) {
    return false;
  }

  return true;
}

export async function createSystemRequestMessage(
  client: RequestChatDbClient,
  options: {
    deliveryRequestId: string;
    senderUserId: string;
    senderRole: Role;
    messageText: string;
  },
) {
  const { deliveryRequestId, senderUserId, senderRole, messageText } = options;

  try {
    return await client.requestMessage.create({
      data: {
        deliveryRequestId,
        senderUserId,
        senderRole,
        messageText,
        isSystem: true,
      },
    });
  } catch (error) {
    console.warn('Failed to write system request message', {
      deliveryRequestId,
      senderUserId,
      messageText,
      error,
    });
    return null;
  }
}

export async function closeRequestChat(
  client: RequestChatDbClient,
  options: {
    deliveryRequestId: string;
    senderUserId: string;
    senderRole: Role;
    closedAt?: Date;
  },
) {
  const { deliveryRequestId, senderUserId, senderRole, closedAt = new Date() } = options;

  const existing = await client.deliveryRequest.findUnique({
    where: { id: deliveryRequestId },
    select: {
      chatClosedAt: true,
    },
  });

  if (!existing || existing.chatClosedAt) {
    return;
  }

  await client.deliveryRequest.update({
    where: { id: deliveryRequestId },
    data: {
      chatEnabled: false,
      chatClosedAt: closedAt,
    },
  });

  await createSystemRequestMessage(client, {
    deliveryRequestId,
    senderUserId,
    senderRole,
    messageText: DELIVERED_CHAT_CLOSED_MESSAGE,
  });
}
