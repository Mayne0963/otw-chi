'use client';

type RequestChatRole = 'CUSTOMER' | 'DRIVER' | 'ADMIN' | 'FRANCHISE';

type QuickRepliesProps = {
  role: RequestChatRole;
  disabled?: boolean;
  onSelect: (message: string) => void;
};

const PRESETS_BY_ROLE: Record<RequestChatRole, string[]> = {
  CUSTOMER: [
    "I'm here / Gate code is ____",
    'Pickup is under ____',
    'Please leave at door',
  ],
  DRIVER: [
    'On my way',
    'Arrived',
    'Merchant says 10 minutes',
    'Need more info',
  ],
  ADMIN: [
    'Support joined this thread',
    'Please keep messages related to this request',
  ],
  FRANCHISE: [],
};

export default function QuickReplies({ role, disabled = false, onSelect }: QuickRepliesProps) {
  const replies = PRESETS_BY_ROLE[role] ?? [];

  if (replies.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {replies.map((reply) => (
        <button
          key={reply}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(reply)}
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80 transition hover:border-otwGold/50 hover:text-otwGold disabled:cursor-not-allowed disabled:opacity-40"
        >
          {reply}
        </button>
      ))}
    </div>
  );
}
