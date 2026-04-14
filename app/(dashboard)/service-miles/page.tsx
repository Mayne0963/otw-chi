import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwButton from '@/components/ui/otw/OtwButton';
import { ServiceMilesCalculator } from '@/components/membership/ServiceMilesCalculator';

export const dynamic = 'force-dynamic';

export default function ServiceMilesPage() {
  return (
    <OtwPageShell>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <OtwSectionHeader
          title="Member Request"
          subtitle="Quote and submit a member request."
        />
        <OtwButton href="/service-miles/history" variant="outline" size="sm">
          View History
        </OtwButton>
      </div>
      <div className="mt-6">
        <ServiceMilesCalculator />
      </div>
    </OtwPageShell>
  );
}
