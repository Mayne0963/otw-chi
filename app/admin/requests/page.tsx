import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import { getPrisma } from '@/lib/db';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminRequestsPage() {
  await requireRole(['ADMIN']);
  const prisma = getPrisma();
  const requests = await prisma.request.findMany({ orderBy: { createdAt: 'desc' }, take: 50, include: { zone: true, assignedDriver: { include: { user: true } }, customer: true } });
  const drivers = await prisma.driverProfile.findMany({ include: { user: true } });
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Admin — Requests" subtitle="Manage lifecycle and assignments." />
      <OtwCard className="mt-3">
        {requests.length === 0 ? (
          <OtwEmptyState title="No requests" subtitle="Once customers submit, they will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="opacity-60">
                <tr>
                  <th className="text-left px-3 py-2">ID</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Pickup</th>
                  <th className="text-left px-3 py-2">Dropoff</th>
                  <th className="text-left px-3 py-2">Zone</th>
                  <th className="text-left px-3 py-2">Driver</th>
                  <th className="text-left px-3 py-2">Assign</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r.id} className="border-t border-white/10">
                    <td className="px-3 py-2">{r.id}</td>
                    <td className="px-3 py-2">{r.status}</td>
                    <td className="px-3 py-2">{r.pickup}</td>
                    <td className="px-3 py-2">{r.dropoff}</td>
                    <td className="px-3 py-2">{r.zone?.name ?? '-'}</td>
                    <td className="px-3 py-2">{r.assignedDriver?.user?.name ?? '-'}</td>
                    <td className="px-3 py-2">
                      <form action={assignDriverAction} className="flex gap-2">
                        <input type="hidden" name="id" value={r.id} />
                        <select name="driverProfileId" className="rounded-lg bg-otwBlack/40 border border-white/15 px-2 py-1">
                          <option value="">Select</option>
                          {drivers.map(d => (
                            <option key={d.id} value={d.id}>{d.user?.name ?? d.id}</option>
                          ))}
                        </select>
                        <OtwButton variant="outline">Assign</OtwButton>
                      </form>
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

export async function assignDriverAction(formData: FormData) {
  'use server';
  const id = String(formData.get('id') ?? '');
  const driverProfileId = String(formData.get('driverProfileId') ?? '');
  if (!id || !driverProfileId) return;
  const prisma = getPrisma();
  await prisma.request.update({ where: { id }, data: { assignedDriverId: driverProfileId, status: 'ASSIGNED' } });
  await prisma.requestEvent.create({ data: { requestId: id, type: 'ASSIGNED', message: `Assigned to driver ${driverProfileId}` } });
}
