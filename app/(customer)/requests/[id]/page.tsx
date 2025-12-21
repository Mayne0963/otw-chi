import { getRequest, cancelRequest } from '@/app/actions/requests';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { MapPin, Calendar, DollarSign, Truck } from 'lucide-react';

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const request = await getRequest(params.id);

  if (!request) {
    notFound();
  }

  const isCancellable = request.status === 'SUBMITTED' || request.status === 'DRAFT';

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-otw-text">Request #{request.id.slice(-6)}</h1>
            <Badge variant={request.status === 'SUBMITTED' ? 'secondary' : 'outline'}>
              {request.status}
            </Badge>
          </div>
          <p className="text-otw-textMuted">Created on {format(request.createdAt, 'PPP p')}</p>
        </div>
        
        {isCancellable && (
          <form action={cancelRequest.bind(null, request.id)}>
            <Button variant="destructive">Cancel Request</Button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Service Type" 
          value={request.serviceType} 
          icon={Truck}
        />
        <StatCard 
          title="Estimated Cost" 
          value={request.costEstimate ? `$${(request.costEstimate / 100).toFixed(2)}` : "Pending"} 
          icon={DollarSign}
        />
        <StatCard 
          title="Est. Distance" 
          value={request.milesEstimate ? `${request.milesEstimate} mi` : "Pending"} 
          icon={MapPin}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-otw-panel border border-otw-border rounded-3xl p-6 shadow-otwSoft">
            <h3 className="text-xl font-bold text-otw-text mb-6">Route Details</h3>
            
            <div className="relative border-l-2 border-otw-border ml-3 pl-8 space-y-8 py-2">
              <div className="relative">
                <div className="absolute -left-[41px] top-0 w-6 h-6 rounded-full bg-otw-primary border-4 border-otw-panel" />
                <h4 className="text-sm font-semibold text-otw-textMuted uppercase tracking-wider mb-1">Pickup</h4>
                <p className="text-lg text-otw-text">{request.pickup}</p>
              </div>
              
              <div className="relative">
                <div className="absolute -left-[41px] top-0 w-6 h-6 rounded-full bg-otw-accent border-4 border-otw-panel" />
                <h4 className="text-sm font-semibold text-otw-textMuted uppercase tracking-wider mb-1">Dropoff</h4>
                <p className="text-lg text-otw-text">{request.dropoff}</p>
              </div>
            </div>

            {request.notes && (
              <div className="mt-8 pt-6 border-t border-otw-border">
                <h4 className="text-sm font-semibold text-otw-textMuted uppercase tracking-wider mb-2">Notes</h4>
                <p className="text-otw-text bg-otw-bg p-4 rounded-xl">{request.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-6">
          <div className="bg-otw-panel border border-otw-border rounded-3xl p-6">
            <h3 className="text-lg font-bold text-otw-text mb-4">Timeline</h3>
            <div className="space-y-6">
              {request.events.map((event) => (
                <div key={event.id} className="flex gap-4">
                  <div className="mt-1">
                    <div className="w-2 h-2 rounded-full bg-otw-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-otw-text">{event.message}</p>
                    <p className="text-xs text-otw-textMuted">{format(event.timestamp, 'MMM d, h:mm a')}</p>
                  </div>
                </div>
              ))}
              {request.events.length === 0 && (
                <p className="text-sm text-otw-textMuted">No events yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
