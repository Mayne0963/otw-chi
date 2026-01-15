import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function FranchisePage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="OTW Franchise" subtitle="Zone ownership and local operations." />
      <Card className="mt-3 p-5 sm:p-6">
        <p className="text-sm opacity-80">Own a city zone and operate OTW runs with revenue share.</p>
        <div className="mt-3">
          <Button asChild variant="gold">
            <Link href="/franchise/apply">Apply</Link>
          </Button>
        </div>
      </Card>
    </OtwPageShell>
  );
}

