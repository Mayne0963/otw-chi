import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { serverFeatureFlags } from '@/lib/featureFlags';
import { isRequestChatOpen, isRequestParticipant } from '@/lib/request-chat';

export const runtime = 'nodejs';

const MAX_MESSAGE_LENGTH = 1000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

type RouteParams = { params: Promise<{ id: string }> };

function buildChatPostLogContext(args: {
  requestId: string;
  userId: string | null;
  role: string | null;
  request?: {
    assignedDriverId: string | null;
    chatEnabled: boolean;
    chatClosedAt: Date | null;
    status: string;
  } | null;
}) {
  return {
    requestId: args.requestId,
    userId: args.userId,
    role: args.role,
    assignedDriverId: args.request?.assignedDriverId ?? null,
    chatEnabled: args.request?.chatEnabled ?? null,
    chatClosedAt: args.request?.chatClosedAt?.toISOString() ?? null,
    status: args.request?.status ?? null,
  };
}

async function getRequestForChatAccess(requestId: string) {
  const prisma = getPrisma();

  return prisma.deliveryRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      userId: true,
      assignedDriverId: true,
      status: true,
      chatEnabled: true,
      chatClosedAt: true,
      assignedDriver: {
        select: {
          userId: true,
        },
      },
    },
  });
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  if (!serverFeatureFlags.chat) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const request = await getRequestForChatAccess(id);

  if (!request) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  if (!isRequestParticipant(request, { id: user.id, role: user.role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!request.assignedDriverId && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Chat opens once a driver is assigned' }, { status: 403 });
  }

  const url = new URL(req.url);
  const before = url.searchParams.get('before');
  const rawLimit = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.floor(rawLimit), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  let cursorDate: Date | null = null;
  if (before) {
    const parsed = new Date(before);
    if (!Number.isNaN(parsed.getTime())) {
      cursorDate = parsed;
    }
  }

  const prisma = getPrisma();
  const records = await prisma.requestMessage.findMany({
    where: {
      deliveryRequestId: id,
      ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });

  const hasMore = records.length > limit;
  const selected = hasMore ? records.slice(0, limit) : records;
  const messages = selected.reverse().map((message) => ({
    id: message.id,
    deliveryRequestId: message.deliveryRequestId,
    senderUserId: message.senderUserId,
    senderRole: message.senderRole,
    senderName: message.sender.name,
    senderCurrentRole: message.sender.role,
    messageText: message.messageText,
    isSystem: message.isSystem,
    createdAt: message.createdAt,
  }));

  const nextCursor = hasMore && selected.length > 0
    ? selected[selected.length - 1]?.createdAt.toISOString() ?? null
    : null;

  return NextResponse.json({
    messages,
    nextCursor,
    chatOpen: isRequestChatOpen(request),
    chatClosedAt: request.chatClosedAt,
    requestStatus: request.status,
  });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  if (!serverFeatureFlags.chat) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    console.warn(
      '[request-chat] POST denied: unauthorized',
      buildChatPostLogContext({
        requestId: id,
        userId: null,
        role: null,
      }),
    );
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const request = await getRequestForChatAccess(id);

  if (!request) {
    console.warn(
      '[request-chat] POST denied: request_not_found',
      buildChatPostLogContext({
        requestId: id,
        userId: user.id,
        role: user.role,
      }),
    );
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  if (!isRequestParticipant(request, { id: user.id, role: user.role })) {
    console.warn(
      '[request-chat] POST denied: forbidden_participant',
      buildChatPostLogContext({
        requestId: id,
        userId: user.id,
        role: user.role,
        request,
      }),
    );
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!isRequestChatOpen(request)) {
    console.warn(
      '[request-chat] POST denied: chat_closed',
      buildChatPostLogContext({
        requestId: id,
        userId: user.id,
        role: user.role,
        request,
      }),
    );
    return NextResponse.json({ error: 'Chat is closed for this request' }, { status: 403 });
  }

  let messageText = '';

  try {
    const body = await req.json();
    messageText = String(body?.messageText ?? '').trim();
  } catch {
    console.warn(
      '[request-chat] POST denied: invalid_request_body',
      buildChatPostLogContext({
        requestId: id,
        userId: user.id,
        role: user.role,
        request,
      }),
    );
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!messageText) {
    return NextResponse.json({ error: 'Message text is required' }, { status: 400 });
  }

  if (messageText.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message must be ${MAX_MESSAGE_LENGTH} characters or less` },
      { status: 400 },
    );
  }

  try {
    const prisma = getPrisma();
    const message = await prisma.requestMessage.create({
      data: {
        deliveryRequestId: request.id,
        senderUserId: user.id,
        senderRole: user.role,
        messageText,
        isSystem: false,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: {
        id: message.id,
        deliveryRequestId: message.deliveryRequestId,
        senderUserId: message.senderUserId,
        senderRole: message.senderRole,
        senderName: message.sender.name,
        senderCurrentRole: message.sender.role,
        messageText: message.messageText,
        isSystem: message.isSystem,
        createdAt: message.createdAt,
      },
    });
  } catch (error) {
    console.error('[request-chat] POST failed: create_message_error', {
      ...buildChatPostLogContext({
        requestId: id,
        userId: user.id,
        role: user.role,
        request,
      }),
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json({ error: 'Unable to send message' }, { status: 500 });
  }
}
