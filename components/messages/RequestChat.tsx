'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SendHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn, formatDate } from '@/lib/utils';
import QuickReplies from './QuickReplies';

type RequestChatRole = 'CUSTOMER' | 'DRIVER' | 'ADMIN' | 'FRANCHISE';

type RequestChatMessage = {
  id: string;
  deliveryRequestId: string;
  senderUserId: string;
  senderRole: RequestChatRole;
  senderName: string | null;
  senderCurrentRole?: RequestChatRole;
  messageText: string;
  isSystem: boolean;
  createdAt: string;
};

type ChatResponse = {
  messages: RequestChatMessage[];
  chatOpen: boolean;
};

type RequestChatProps = {
  requestId: string;
  currentUserId: string;
  currentUserRole: RequestChatRole;
  className?: string;
  readOnly?: boolean;
};

export default function RequestChat({
  requestId,
  currentUserId,
  currentUserRole,
  className,
  readOnly = false,
}: RequestChatProps) {
  const [messages, setMessages] = useState<RequestChatMessage[]>([]);
  const [draftMessage, setDraftMessage] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement | null>(null);

  const fetchMessages = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
    }

    try {
      const response = await fetch(`/api/requests/${requestId}/messages?limit=100`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Unable to load messages');
      }

      const payload = (await response.json()) as ChatResponse;
      setMessages(Array.isArray(payload.messages) ? payload.messages : []);
      setChatOpen(Boolean(payload.chatOpen));
      setError(null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unable to load messages');
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [requestId]);

  useEffect(() => {
    void fetchMessages();

    const timer = setInterval(() => {
      void fetchMessages(true);
    }, 7000);

    return () => clearInterval(timer);
  }, [fetchMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const canSend = useMemo(() => !readOnly && chatOpen, [chatOpen, readOnly]);

  const submitMessage = useCallback(async () => {
    const trimmed = draftMessage.trim();

    if (!trimmed || !canSend || isSending) {
      return;
    }

    setIsSending(true);

    try {
      const response = await fetch(`/api/requests/${requestId}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messageText: trimmed }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        const message = payload?.error ?? 'Unable to send message';

        if (response.status === 403) {
          setChatOpen(false);
        }

        throw new Error(message);
      }

      setDraftMessage('');
      await fetchMessages(true);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to send message');
    } finally {
      setIsSending(false);
    }
  }, [canSend, draftMessage, fetchMessages, isSending, requestId]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitMessage();
  };

  return (
    <div className={cn('rounded-xl border border-white/10 bg-black/20 p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">Request Chat</h3>
        <span className={cn(
          'rounded-full px-2 py-0.5 text-xs font-medium',
          chatOpen ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-white/60',
        )}>
          {chatOpen ? 'Open' : 'Closed'}
        </span>
      </div>

      <p className="mt-1 text-xs text-white/60">
        {chatOpen ? 'Message your assigned driver in-app.' : 'Chat is unavailable for this request.'}
      </p>

      <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="text-sm text-white/60">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-white/60">No messages yet.</div>
        ) : (
          messages.map((message) => {
            if (message.isSystem) {
              return (
                <div key={message.id} className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-center text-xs text-white/70">
                  <div>{message.messageText}</div>
                  <div className="mt-1 text-[11px] text-white/45">{formatDate(message.createdAt)}</div>
                </div>
              );
            }

            const isMine = message.senderUserId === currentUserId;

            return (
              <div
                key={message.id}
                className={cn(
                  'max-w-[90%] rounded-lg px-3 py-2',
                  isMine
                    ? 'ml-auto bg-otwGold/20 text-otwGold border border-otwGold/30'
                    : 'bg-white/10 text-white border border-white/15',
                )}
              >
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide opacity-70">
                  {message.senderName || message.senderRole}
                </div>
                <div className="text-sm leading-relaxed">{message.messageText}</div>
                <div className="mt-1 text-[11px] opacity-60">{formatDate(message.createdAt)}</div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}

      {!readOnly && (
        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <QuickReplies
            role={currentUserRole}
            disabled={!canSend || isSending}
            onSelect={(value) => {
              setDraftMessage(value);
            }}
          />

          <Textarea
            value={draftMessage}
            onChange={(event) => setDraftMessage(event.target.value)}
            placeholder={canSend ? 'Type your message...' : 'Chat is closed'}
            className="min-h-[88px] bg-black/30 text-white"
            disabled={!canSend || isSending}
            maxLength={1000}
          />

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="gold"
              size="sm"
              disabled={!canSend || isSending || draftMessage.trim().length === 0}
            >
              <SendHorizontal className="h-3.5 w-3.5" />
              Send
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
