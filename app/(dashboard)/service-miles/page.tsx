import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import { ServiceMilesCalculator } from '@/components/membership/ServiceMilesCalculator';

export const dynamic = 'force-dynamic';

export default function ServiceMilesPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader
        title="Service Miles Calculator"
        subtitle="Quote and submit a member request using your Service Miles balance."
      />
      <div className="mt-6">
        <ServiceMilesCalculator />
      </div>
    </OtwPageShell>
  );
}

