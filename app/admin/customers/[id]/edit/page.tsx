import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { Role } from '@prisma/client';
import { notFound } from 'next/navigation';

const roleOptions: Role[] = ['CUSTOMER', 'DRIVER', 'ADMIN', 'FRANCHISE'];

async function getCustomer(id: string) {
  const prisma = getPrisma();
  return prisma.user.findUnique({
    where: { id },
    include: { customerProfile: true }
  });
}

export async function updateCustomerAction(formData: FormData) {
  'use server';
  await requireRole(['ADMIN']);

  const id = String(formData.get('id') ?? '').trim();
  const nameInput = String(formData.get('name') ?? '').trim();
  const roleInput = String(formData.get('role') ?? '').trim();
  const phoneInput = String(formData.get('phone') ?? '').trim();
  const defaultPickupInput = String(formData.get('defaultPickup') ?? '').trim();
  const defaultDropoffInput = String(formData.get('defaultDropoff') ?? '').trim();

  if (!id) {
    return;
  }

  const prisma = getPrisma();
  const userData: { name?: string | null; role?: Role } = {};

  if (nameInput.length > 0) {
    userData.name = nameInput;
  } else {
    userData.name = null;
  }

  if (roleOptions.includes(roleInput as Role)) {
    userData.role = roleInput as Role;
  }

  await prisma.user.update({
    where: { id },
    data: userData
  });

  await prisma.customerProfile.upsert({
    where: { userId: id },
    create: {
      userId: id,
      phone: phoneInput || null,
      defaultPickup: defaultPickupInput || null,
      defaultDropoff: defaultDropoffInput || null
    },
    update: {
      phone: phoneInput || null,
      defaultPickup: defaultPickupInput || null,
      defaultDropoff: defaultDropoffInput || null
    }
  });

  revalidatePath('/admin/customers');
  revalidatePath(`/admin/customers/${id}`);
  revalidatePath(`/admin/customers/${id}/edit`);
  redirect(`/admin/customers/${id}`);
}

export default async function AdminCustomerEditPage({
  params
}: {
  params: { id: string };
}) {
  await requireRole(['ADMIN']);

  if (!params.id) {
    notFound();
  }

  const customer = await getCustomer(params.id);

  return (
    <OtwPageShell>
      <OtwSectionHeader
        title="Edit Customer"
        subtitle="Update customer profile details and role."
      />

      <div className="mt-6 flex items-center gap-2">
        <Link
          href={`/admin/customers/${params.id}`}
          className="text-xs px-3 py-2 rounded bg-white/10 hover:bg-white/20 transition-colors"
        >
          Back to Details
        </Link>
        <Link
          href="/admin/customers"
          className="text-xs px-3 py-2 rounded bg-white/10 hover:bg-white/20 transition-colors"
        >
          Back to Customers
        </Link>
      </div>

      <OtwCard className="mt-4 p-6">
        {!customer ? (
          <OtwEmptyState
            title="Customer not found"
            subtitle="This customer record could not be located."
          />
        ) : (
          <form action={updateCustomerAction} className="space-y-5">
            <input type="hidden" name="id" value={customer.id} />

            <div>
              <label className="text-xs text-white/60">Name</label>
              <input
                name="name"
                defaultValue={customer.name ?? ''}
                className="mt-2 w-full rounded bg-otwBlack/40 border border-white/15 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-white/60">Role</label>
              <select
                name="role"
                defaultValue={customer.role}
                className="mt-2 w-full rounded bg-otwBlack/40 border border-white/15 px-3 py-2 text-sm"
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/60">Phone</label>
                <input
                  name="phone"
                  defaultValue={customer.customerProfile?.phone ?? ''}
                  className="mt-2 w-full rounded bg-otwBlack/40 border border-white/15 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Default Pickup</label>
                <input
                  name="defaultPickup"
                  defaultValue={customer.customerProfile?.defaultPickup ?? ''}
                  className="mt-2 w-full rounded bg-otwBlack/40 border border-white/15 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-white/60">Default Dropoff</label>
              <input
                name="defaultDropoff"
                defaultValue={customer.customerProfile?.defaultDropoff ?? ''}
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
