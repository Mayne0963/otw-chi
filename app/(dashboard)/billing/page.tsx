import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ success?: string, canceled?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return <div>Please log in</div>;

  const prisma = getPrisma();
  const membership = await prisma.membershipSubscription.findUnique({
    where: { userId: user.id },
    include: { plan: true },
  });

  const { success, canceled } = await searchParams;
  const isActive = membership?.status === 'ACTIVE' || membership?.status === 'TRIALING';
  const planName = membership?.plan?.name || (membership?.stripePriceId ? 'Custom Plan' : 'Basic');
  const statusLabel = membership?.status ? membership.status.replace('_', ' ') : 'Inactive';

  return (
    <div className="space-y-6">
        <h1 className="text-3xl font-bold">Billing & Membership</h1>
        
        {success && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-500 rounded-lg">
                Subscription successful! Welcome to OTW.
            </div>
        )}
        
        {canceled && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg">
                Subscription canceled.
            </div>
        )}

        <Card className="bg-white/5 border-white/10 text-otwOffWhite">
            <CardHeader>
                <CardTitle>Current Plan</CardTitle>
                <CardDescription>Your membership status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <span>Status</span>
                    <Badge variant={isActive ? 'default' : 'secondary'} className={isActive ? 'bg-green-500' : ''}>
                        {statusLabel}
                    </Badge>
                </div>
                <div className="flex items-center justify-between">
                    <span>Plan</span>
                    <span className="font-semibold text-sm">{planName}</span> 
                </div>
                {membership?.currentPeriodEnd && (
                    <div className="flex items-center justify-between text-sm text-white/50">
                        <span>Renews</span>
                        <span>{membership.currentPeriodEnd.toLocaleDateString()}</span>
                    </div>
                )}
            </CardContent>
        </Card>
    </div>
  );
}
