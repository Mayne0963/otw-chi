import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminPayoutsPage() {
  await requireRole(['ADMIN']);
  const prisma = getPrisma();
  const tickets = await prisma.supportTicket.findMany({
    where: { subject: 'Payout Request' },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: true },
  });
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Admin — Payout Requests" subtitle="Review and resolve driver payout requests." />
      <OtwCard className="mt-3">
        {tickets.length === 0 ? (
          <OtwEmptyState title="No payout requests" subtitle="New payout requests will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="opacity-60">
                <tr>
                  <th className="text-left px-3 py-2">Created</th>
                  <th className="text-left px-3 py-2">Driver</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Message</th>
                  <th className="text-left px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(t => (
                  <tr key={t.id} className="border-t border-white/10">
                    <td className="px-3 py-2">{new Date(t.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{t.user?.name ?? t.user?.email ?? t.userId}</td>
                    <td className="px-3 py-2">{t.status}</td>
                    <td className="px-3 py-2 whitespace-pre-line">{t.message}</td>
                    <td className="px-3 py-2">
                      {t.status !== 'RESOLVED' && (
                        <form action={resolveTicketAction}>
                          <input type="hidden" name="id" value={t.id} />
                          <OtwButton variant="outline">Mark Resolved</OtwButton>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </OtwCard>
    </OtwPageShell>
  );
}

export async function resolveTicketAction(formData: FormData) {
  'use server';
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const prisma = getPrisma();
  await prisma.supportTicket.update({
    where: { id },
    data: { status: 'RESOLVED' },
  });
}
