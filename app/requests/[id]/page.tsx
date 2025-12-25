import { notFound } from 'next/navigation';
import { getPrisma } from '@/lib/db';
import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import { Badge } from '@/components/ui/badge';
import { MapPin, User } from 'lucide-react';

export default async function RequestTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prisma = getPrisma();
  
  const request = await prisma.request.findUnique({
    where: { id },
    include: { assignedDriver: { include: { user: true } } },
  });

  if (!request) notFound();

  return (
    <OtwPageShell>
      <OtwSectionHeader title="Track Your Order" subtitle={`Order #${request.id.slice(-6)}`} />

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
            <OtwCard>
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-otwGold">Status</h3>
                    <Badge variant={request.status === 'DELIVERED' ? 'default' : 'secondary'} className="text-sm">
                        {request.status.replace('_', ' ')}
                    </Badge>
                </div>
                
                <div className="space-y-4">
                    <div className="flex gap-3">
                        <MapPin className="text-green-500 w-5 h-5 shrink-0" />
                        <div>
                            <p className="text-xs text-white/50">Pickup</p>
                            <p className="text-otwOffWhite">{request.pickup}</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <MapPin className="text-red-500 w-5 h-5 shrink-0" />
                        <div>
                            <p className="text-xs text-white/50">Dropoff</p>
                            <p className="text-otwOffWhite">{request.dropoff}</p>
                        </div>
                    </div>
                </div>
            </OtwCard>

            {request.assignedDriver && (
                <OtwCard>
                    <h3 className="text-xl font-bold text-otwGold mb-4">Driver</h3>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center">
                            <User className="w-6 h-6 text-otwOffWhite" />
                        </div>
                        <div>
                            <p className="font-medium text-otwOffWhite">{request.assignedDriver.user.name}</p>
                            <p className="text-sm text-white/50">OTW Certified Driver</p>
                        </div>
                    </div>
                </OtwCard>
            )}
        </div>

        <OtwCard className="min-h-[300px] flex items-center justify-center bg-white/5">
            <div className="text-center text-white/40">
                <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Live Map Tracking</p>
                <p className="text-xs">(Coming Soon)</p>
            </div>
        </OtwCard>
      </div>
    </OtwPageShell>
  );
}
