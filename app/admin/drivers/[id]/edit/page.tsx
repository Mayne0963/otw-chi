import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';

const statusOptions = ['ONLINE', 'BUSY', 'OFFLINE'] as const;

type DriverStatus = (typeof statusOptions)[number];

async function getDriver(id: string) {
  const prisma = getPrisma();
  const driver = await prisma.driverProfile.findUnique({
    where: { id },
    include: {
      user: true,
      zone: { select: { id: true, name: true } }
    }
  });

  const zones = await prisma.zone.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' }
  });

  return { driver, zones };
}

export async function updateDriverAction(formData: FormData) {
  'use server';
  await requireRole(['ADMIN']);

  const id = String(formData.get('id') ?? '').trim();
  const statusInput = String(formData.get('status') ?? '').trim();
  const zoneIdInput = String(formData.get('zoneId') ?? '').trim();
  const ratingInput = String(formData.get('rating') ?? '').trim();

  if (!id) return;

  const prisma = getPrisma();
  const data: {
    status?: DriverStatus;
    zoneId?: string | null;
    rating?: number | null;
  } = {};

  if (statusOptions.includes(statusInput as DriverStatus)) {
    data.status = statusInput as DriverStatus;
  }

  data.zoneId = zoneIdInput.length > 0 ? zoneIdInput : null;

  if (ratingInput.length > 0 && !Number.isNaN(Number(ratingInput))) {
    data.rating = Number(ratingInput);
  } else {
    data.rating = null;
  }

  await prisma.driverProfile.update({
    where: { id },
    data
  });

  revalidatePath('/admin/drivers');
  revalidatePath(`/admin/drivers/${id}`);
  revalidatePath(`/admin/drivers/${id}/edit`);
  redirect(`/admin/drivers/${id}`);
}

export default async function AdminDriverEditPage({
  params
}: {
  params: { id: string };
}) {
  await requireRole(['ADMIN']);

  if (!params.id) {
    notFound();
  }

  const { driver, zones } = await getDriver(params.id);

  return (
    <OtwPageShell>
      <OtwSectionHeader
        title="Edit Driver"
        subtitle="Update driver status, zone, and rating."
      />

      <div className="mt-6 flex items-center gap-2">
        <Link
          href={`/admin/drivers/${params.id}`}
          className="text-xs px-3 py-2 rounded bg-white/10 hover:bg-white/20 transition-colors"
        >
          Back to Details
        </Link>
        <Link
          href="/admin/drivers"
          className="text-xs px-3 py-2 rounded bg-white/10 hover:bg-white/20 transition-colors"
        >
          Back to Drivers
        </Link>
      </div>

      <OtwCard className="mt-4 p-6">
        {!driver ? (
          <OtwEmptyState
            title="Driver not found"
            subtitle="This driver profile could not be located."
          />
        ) : (
          <form action={updateDriverAction} className="space-y-5">
            <input type="hidden" name="id" value={driver.id} />

            <div>
              <label className="text-xs text-white/60">Driver</label>
              <div className="mt-2 text-sm text-white">
                {driver.user.name || 'Unknown Driver'} ({driver.user.email})
              </div>
            </div>

            <div>
              <label className="text-xs text-white/60">Status</label>
              <select
                name="status"
                defaultValue={driver.status}
                className="mt-2 w-full rounded bg-otwBlack/40 border border-white/15 px-3 py-2 text-sm"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-white/60">Zone</label>
              <select
                name="zoneId"
                defaultValue={driver.zone?.id ?? ''}
                className="mt-2 w-full rounded bg-otwBlack/40 border border-white/15 px-3 py-2 text-sm"
              >
                <option value="">Unassigned</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-white/60">Rating</label>
              <input
                name="rating"
                type="number"
                step="0.1"
                min="0"
                max="5"
                defaultValue={driver.rating ?? ''}
                className="mt-2 w-full rounded bg-otwBlack/40 border border-white/15 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="text-sm px-4 py-2 rounded bg-otwGold/20 hover:bg-otwGold/30 text-otwGold transition-colors"
              >
                Save Changes
              </button>
            </div>
          </form>
        )}
      </OtwCard>
    </OtwPageShell>
  );
}
