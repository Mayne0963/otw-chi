import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import { getCurrentUser } from '@/lib/auth/roles';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Onboarding" subtitle="Finish setup to unlock your OTW experience." />
      <div className="mt-3">
        <OtwCard>
          <div className="text-sm opacity-90">
            {user ? `Welcome, ${user.name || user.email}.` : 'Welcome.'}
          </div>
          <div className="mt-3">
            <OtwButton as="a" href="/dashboard" variant="gold">Continue</OtwButton>
          </div>
        </OtwCard>
      </div>
    </OtwPageShell>
  );
}

