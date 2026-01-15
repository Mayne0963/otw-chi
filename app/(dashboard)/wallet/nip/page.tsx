import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import { Card } from '@/components/ui/card';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { Badge } from '@/components/ui/badge';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import { ensureWeeklyActiveMemberGrant } from '@/app/actions/nip';

export const dynamic = 'force-dynamic';

export default async function NipWalletPage() {
  const prisma = getPrisma();
  const user = await getCurrentUser();
  if (!user) {
    return (
      <OtwPageShell>
        <OtwSectionHeader title="NIP Wallet" subtitle="Rewards and transactions." />
        <Card className="mt-3 p-5 sm:p-6">
        <OtwEmptyState title="Sign in to view NIP" subtitle="Access your wallet and transactions." actionHref="/sign-in" actionLabel="Sign In" />
      </Card>
      </OtwPageShell>
    );
  }
  await ensureWeeklyActiveMemberGrant();
  let entries: { id: string; amount: number; reason?: string | null; type?: string; createdAt: Date }[] = [];
  try {
    entries = await prisma.nipTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }) ?? [];
  } catch {
    entries = await prisma.nIPLedger.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }
  const balance = entries.reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const totalEarned = entries.filter(e => (e.amount ?? 0) > 0).reduce((sum, e) => sum + (e.amount ?? 0), 0);
  return (
    <OtwPageShell>
      <OtwSectionHeader title="NIP Wallet" subtitle="Rewards and transactions." />
      <div className="mt-3 grid md:grid-cols-3 gap-4">
        <Card className="p-5 sm:p-6">
          <div className="text-sm font-medium">Balance</div>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs">
            <Badge variant="outline" className="h-5 px-2 text-[10px] uppercase tracking-wide">NIP</Badge>
            <span className="text-sm font-semibold text-emerald-400">{String(balance)}</span>
          </div>
        </Card>
        <Card className="p-5 sm:p-6">
          <div className="text-sm font-medium">Total Earned</div>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs">
            <Badge variant="outline" className="h-5 px-2 text-[10px] uppercase tracking-wide">NIP</Badge>
            <span className="text-sm font-semibold text-amber-300">{String(totalEarned)}</span>
          </div>
        </Card>
        <Card className="p-5 sm:p-6">
          <div className="text-sm font-medium">Ways to earn NIP</div>
          <ul className="mt-2 text-sm opacity-80 space-y-1">
            <li>• First completed order: +50</li>
            <li>• Weekly active member: +25</li>
            <li>• On-time payment: +10</li>
            <li>• Referral bonus: +100</li>
          </ul>
        </Card>
      </div>
      <div className="mt-3 grid md:grid-cols-2 gap-4">
        <Card className="p-5 sm:p-6">
          <div className="text-sm font-medium">Ways to spend NIP</div>
          <ul className="mt-2 text-sm opacity-80 space-y-1">
            <li>• Order discounts</li>
            <li>• Priority dispatch</li>
            <li>• Fee waivers</li>
          </ul>
        </Card>
        <Card className="p-5 sm:p-6">
          <div className="text-sm font-medium">Recent Transactions</div>
          {entries.length === 0 ? (
            <OtwEmptyState title="No NIP data yet" subtitle="Complete an OTW run to start earning." actionHref="/requests" actionLabel="View Requests" />
          ) : (
            <ul className="mt-2 space-y-2 text-sm opacity-90">
              {entries.map(e => (
                <li key={e.id} className="flex items-center justify-between">
                  <div>{String(e.reason ?? e.type ?? '')}</div>
                  <div className={(e.amount ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {(e.amount ?? 0) >= 0 ? '+' : ''}{e.amount ?? 0} NIP
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </OtwPageShell>
  );
}
