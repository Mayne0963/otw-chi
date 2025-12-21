import { getRequest } from '@/app/actions/request';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatCurrency } from '@/lib/utils';
import { MapPin, Calendar, Clock, User, CheckCircle2, Circle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/roles';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/sign-in');
  }

  const request = await getRequest(params.id);

  if (!request) {
    return (
      <div className="space-y-6">
        <PageHeader title="Request Not Found" subtitle="We couldn't find the request you're looking for." />
        <Button asChild variant="secondary">
          <Link href="/requests">Back to Requests</Link>
        </Button>
      </div>
    );
  }

  // Authorization Check: Must be Owner, Assigned Driver, or Admin
  const isOwner = request.customerId === user.id;
  const isAssignedDriver = request.assignedDriver?.userId === user.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isOwner && !isAssignedDriver && !isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="Access Denied" subtitle="You are not authorized to view this request." />
        <Button asChild variant="secondary">
          <Link href="/requests">Back to Requests</Link>
        </Button>
      </div>
    );
  }

  const driverName = request.assignedDriver?.user?.name;
  const driverRating = request.assignedDriver?.rating;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link href="/requests">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <PageHeader 
            title={`Request ${request.id.slice(-6).toUpperCase()}`} 
            subtitle={`Created on ${formatDate(request.createdAt)}`}
            className="mb-0"
          />
        </div>
        {/* Placeholder for action buttons like Cancel or Contact Support */}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Details */}
        <div className="space-y-6 md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Request Details</CardTitle>
              <CardDescription>Information about your delivery.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-white/60">Status</div>
                  <Badge variant={
                    request.status === 'COMPLETED' || request.status === 'DELIVERED' ? 'success' :
                    request.status === 'CANCELLED' ? 'destructive' :
                    request.status === 'ASSIGNED' || request.status === 'PICKED_UP' ? 'secondary' :
                    'outline'
                  } className="text-base px-3 py-1">
                    {request.status}
                  </Badge>
                </div>
                <div className="space-y-1 text-right">
                  <div className="text-sm font-medium text-white/60">Cost</div>
                  <div className="text-xl font-bold">
                    {request.costEstimate ? formatCurrency(request.costEstimate / 100) : '-'}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-white/60">Service Type</div>
                  <div className="flex items-center gap-2 font-medium">
                    <span className="text-xl">
                      {request.serviceType === 'FOOD' ? '🍔' : 
                       request.serviceType === 'STORE' ? '🛒' : 
                       request.serviceType === 'FRAGILE' ? '📦' : '🏁'}
                    </span>
                    {request.serviceType}
                  </div>
                </div>
                {driverName && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-white/60">Driver</div>
                    <div className="flex items-center gap-2 font-medium">
                      <User className="h-4 w-4 text-otwGold" />
                      {driverName}
                      {driverRating && <span className="text-white/60 text-sm">({driverRating.toFixed(1)} ★)</span>}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-otwGold mt-2" />
                    <div className="h-full w-px bg-white/10 my-1" />
                  </div>
                  <div className="pb-4">
                    <div className="text-sm font-medium text-white/60">Pickup</div>
                    <div className="mt-1">{request.pickup}</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-otwGold mt-2" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white/60">Dropoff</div>
                    <div className="mt-1">{request.dropoff}</div>
                  </div>
                </div>
              </div>

              {request.notes && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-white/60">Notes</div>
                  <div className="text-sm opacity-80 bg-white/5 p-3 rounded-md border border-white/10">
                    {request.notes}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Timeline */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>History of this request.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative space-y-6 pl-4 before:absolute before:left-[5px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-white/10">
                {request.events && request.events.length > 0 ? (
                  request.events.map((event: any, index: number) => (
                    <div key={event.id} className="relative flex gap-4">
                      <div className="absolute -left-[15px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-otwGold bg-otwBlack ring-4 ring-otwBlack" />
                      <div className="space-y-1">
                        <div className="text-sm font-medium leading-none">
                          {event.type.replace('STATUS_', '').replace(/_/g, ' ')}
                        </div>
                        <div className="text-xs text-white/60">
                          {formatDate(event.timestamp)}
                        </div>
                        {event.message && (
                          <div className="text-xs text-white/50 mt-1">
                            {event.message}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-white/60">No events yet.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
