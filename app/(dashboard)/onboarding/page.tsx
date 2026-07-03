import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/auth/roles';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Onboarding" subtitle="Finish setup to unlock your OTW experience." />
      <div className="mt-3">
        <Card className="p-5 sm:p-6">
          <div className="text-sm opacity-90">
            {user ? `Welcome, ${user.name || user.email}.` : 'Welcome.'}
          </div>
          <div className="mt-3">
            <Button asChild variant="gold">
              <Link href="/dashboard">Continue</Link>
            </Button>
          </div>
        </Card>
      </div>
    </OtwPageShell>
  );
}

