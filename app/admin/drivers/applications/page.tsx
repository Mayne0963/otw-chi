import { requireRole } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { revalidatePath } from 'next/cache';
import { clerkClient } from '@clerk/nextjs/server';

export default async function AdminDriverApplicationsPage() {
  await requireRole(['ADMIN']);
  const prisma = getPrisma();
  
  const applications = await prisma.driverApplication.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: true },
  });

  async function updateStatus(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    const status = formData.get('status') as 'APPROVED' | 'DENIED';
    
    if (!id || !status) return;
    
    const prisma = getPrisma();
    const app = await prisma.driverApplication.findUnique({ where: { id } });
    if (!app) return;

    await prisma.driverApplication.update({
        where: { id },
        data: { status },
    });

    if (status === 'APPROVED' && app.userId) {
        // Create Driver Profile
        await prisma.driverProfile.upsert({
            where: { userId: app.userId },
            create: { userId: app.userId, status: 'OFFLINE' },
            update: {},
        });

        // Update User Role in DB
        await prisma.user.update({
            where: { id: app.userId },
            data: { role: 'DRIVER' },
        });
        
        // Sync to Clerk
        const user = await prisma.user.findUnique({ where: { id: app.userId } });
        if (user?.clerkId) {
             try {
                 const client = await clerkClient();
                 await client.users.updateUserMetadata(user.clerkId, {
                    publicMetadata: {
                        role: 'DRIVER',
                        otw_role: 'driver'
                    }
                 });
             } catch (e) {
                 console.error('Failed to sync Clerk metadata:', e);
             }
        }
    }
    
    revalidatePath('/admin/drivers/applications');
  }

  return (
    <OtwPageShell>
      <OtwSectionHeader 
        title="Driver Applications" 
        subtitle="Review and approve driver applications."
      />

      <div className="grid gap-4 mt-6">
        {applications.map((app) => (
            <OtwCard key={app.id} className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="text-lg font-semibold text-white">{app.fullName}</div>
                        <p className="text-sm text-white/50">{app.email} • {app.phone}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                        app.status === 'APPROVED' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 
                        app.status === 'DENIED' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                        'bg-white/10 text-white/70 border border-white/20'
                    }`}>
                        {app.status}
                    </span>
                </div>
                <div>
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                        <div>
                            <p className="text-white/50">City</p>
                            <p>{app.city}</p>
                        </div>
                        <div>
                            <p className="text-white/50">Vehicle</p>
                            <p>{app.vehicleType}</p>
                        </div>
                        {app.availability && (
                            <div className="col-span-2">
                                <p className="text-white/50">Availability</p>
                                <p>{app.availability}</p>
                            </div>
                        )}
                        {app.message && (
                            <div className="col-span-2">
                                <p className="text-white/50">Message</p>
                                <p>{app.message}</p>
                            </div>
                        )}
                    </div>

                    {app.status === 'PENDING' && (
                        <div className="flex gap-2">
                            <form action={updateStatus}>
                                <input type="hidden" name="id" value={app.id} />
                                <input type="hidden" name="status" value="APPROVED" />
                                <OtwButton type="submit" variant="outline" className="h-8 text-xs border-green-600/50 text-green-500 hover:bg-green-600/10 hover:text-green-400">
                                    Approve
                                </OtwButton>
                            </form>
                            <form action={updateStatus}>
                                <input type="hidden" name="id" value={app.id} />
                                <input type="hidden" name="status" value="DENIED" />
                                <OtwButton type="submit" variant="red" className="h-8 text-xs">
                                    Deny
                                </OtwButton>
                            </form>
                        </div>
                    )}
                </div>
            </OtwCard>
        ))}
        {applications.length === 0 && (
            <OtwCard className="p-8 text-center">
                <OtwEmptyState 
                    title="No applications found" 
                    subtitle="Driver applications will appear here." 
                />
            </OtwCard>
        )}
      </div>
    </OtwPageShell>
  );
}
