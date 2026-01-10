import { requireRole } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Driver Applications</h1>
      </div>

      <div className="grid gap-4">
        {applications.map((app) => (
            <Card key={app.id} className="bg-white/5 border-white/10 text-otwOffWhite">
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>{app.fullName}</CardTitle>
                            <p className="text-sm text-white/50">{app.email} • {app.phone}</p>
                        </div>
                        <Badge variant={
                            app.status === 'APPROVED' ? 'default' : 
                            app.status === 'DENIED' ? 'destructive' : 'secondary'
                        } className={app.status === 'APPROVED' ? 'bg-green-500' : ''}>
                            {app.status}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
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
                                <Button type="submit" variant="outline" className="h-8 text-xs border-green-600/50 text-green-500 hover:bg-green-600/10 hover:text-green-400">
                                    Approve
                                </Button>
                            </form>
                            <form action={updateStatus}>
                                <input type="hidden" name="id" value={app.id} />
                                <input type="hidden" name="status" value="DENIED" />
                                <Button type="submit" variant="destructive" className="h-8 text-xs">
                                    Deny
                                </Button>
                            </form>
                        </div>
                    )}
                </CardContent>
            </Card>
        ))}
        {applications.length === 0 && (
            <div className="text-center py-10 text-white/50">No applications found.</div>
        )}
      </div>
    </div>
  );
}
