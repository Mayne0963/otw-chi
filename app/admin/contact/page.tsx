import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { Button } from '@/components/ui/button';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';

export const dynamic = 'force-dynamic';

export default async function AdminContactInboxPage() {
  await requireRole(['ADMIN']);

  const prisma = getPrisma();
  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const lastDayCount = await prisma.contactMessage.count({
    where: { createdAt: { gte: since } },
  });

  return (
    <OtwPageShell>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <OtwSectionHeader
          title="Contact Messages"
          subtitle="Inbound contact form submissions."
        />
        <Button asChild variant="outline" size="sm">
          <a href="/api/admin/contact-messages/export">Export CSV</a>
        </Button>
      </div>

      <OtwCard className="mt-3 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-white">{messages.length}</div>
            <div className="text-xs text-white/60">Total Messages</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-otwGold">{lastDayCount}</div>
            <div className="text-xs text-white/60">Last 24 Hours</div>
          </div>
        </div>
      </OtwCard>

      {messages.length === 0 ? (
        <OtwCard className="mt-3 p-8 text-center">
          <OtwEmptyState
            title="No messages yet"
            subtitle="Contact form messages will appear here."
          />
        </OtwCard>
      ) : (
        <OtwCard className="mt-3">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="opacity-60 border-b border-white/10">
                <tr>
                  <th className="text-left px-4 py-3">Received</th>
                  <th className="text-left px-4 py-3">Sender</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Message</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((message) => (
                  <tr key={message.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-white/60 text-xs">
                      {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{message.user?.name || 'Guest'}</div>
                      {message.user?.role && (
                        <div className="text-xs text-white/40">{message.user.role}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/80">{message.email}</td>
                    <td className="px-4 py-3 text-white/70 text-sm max-w-md truncate" title={message.message}>
                      {message.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </OtwCard>
      )}
    </OtwPageShell>
  );
}
