import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';

export default function NipWalletPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="NIP Wallet" subtitle="Rewards and transactions." />
      <OtwCard className="mt-3">
        <OtwEmptyState title="No NIP data yet" subtitle="Complete OTW runs or join a tier to start earning." actionHref="/requests/new" actionLabel="Start a Request" />
      </OtwCard>
    </OtwPageShell>
  );
}

