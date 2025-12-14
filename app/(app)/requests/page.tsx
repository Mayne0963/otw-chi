import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { getCurrentUser } from '@/lib/auth/roles';

export default async function RequestsListPage() {
  let user = null;
  try { user = await getCurrentUser(); } catch { user = null; }
  return (
    <OtwPageShell>
      <OtwSectionHeader title="My Requests" subtitle="History and status." />
      {!user ? (
        <OtwEmptyState title="Sign in to view requests" actionHref="/sign-in" actionLabel="Sign In" />
      ) : (
        <OtwCard><OtwEmptyState title="No requests yet" subtitle="Make your first run." actionHref="/requests/new" actionLabel="New Request" /></OtwCard>
      )}
    </OtwPageShell>
  );
}

