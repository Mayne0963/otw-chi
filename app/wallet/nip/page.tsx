import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import OtwStatPill from '@/components/ui/otw/OtwStatPill';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';

export const dynamic = 'force-dynamic';

export default async function NipWalletPage() {
  const prisma = getPrisma();
  const user = await getCurrentUser();
  if (!user) {
    return (
      <OtwPageShell>
        <OtwSectionHeader title="NIP Wallet" subtitle="Rewards and transactions." />
        <OtwCard className="mt-3">
          <OtwEmptyState title="Sign in to view NIP" subtitle="Access your wallet and transactions." actionHref="/sign-in" actionLabel="Sign In" />
        </OtwCard>
      </OtwPageShell>
    );
  }
  const entries = await prisma.nIPLedger.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  const balance = entries.reduce((sum, e) => sum + e.amount, 0);
  const totalEarned = entries.filter(e => e.amount > 0).reduce((sum, e) => sum + e.amount, 0);
  return (
    <OtwPageShell>
      <OtwSectionHeader title="NIP Wallet" subtitle="Rewards and transactions." />
      <div className="mt-3 grid md:grid-cols-3 gap-4">
        <OtwCard>
          <div className="text-sm font-medium">Balance</div>
          <div className="mt-2"><OtwStatPill label="NIP" value={String(balance)} tone="success" /></div>
        </OtwCard>
        <OtwCard>
          <div className="text-sm font-medium">Total Earned</div>
          <div className="mt-2"><OtwStatPill label="NIP" value={String(totalEarned)} tone="gold" /></div>
        </OtwCard>
        <OtwCard>
          <div className="text-sm font-medium">Actions</div>
          <div className="mt-2 text-sm opacity-80">Payouts coming soon.</div>
        </OtwCard>
      </div>
      <OtwCard className="mt-3">
        <div className="text-sm font-medium">Recent Transactions</div>
        {entries.length === 0 ? (
          <OtwEmptyState title="No NIP data yet" subtitle="Complete OTW runs to start earning." actionHref="/requests/new" actionLabel="Start a Request" />
        ) : (
          <ul className="mt-2 space-y-2 text-sm opacity-90">
            {entries.map(e => (
              <li key={e.id} className="flex items-center justify-between">
                <div>{e.type}</div>
                <div className={e.amount >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {e.amount >= 0 ? '+' : ''}{e.amount} NIP
                </div>
              </li>
            ))}
          </ul>
        )}
      </OtwCard>
    </OtwPageShell>
  );
}
