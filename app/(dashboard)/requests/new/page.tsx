import { NewRequestForm } from '@/components/otw/NewRequestForm';
import { PageHeader } from '@/components/ui/page-header';

export const dynamic = 'force-dynamic';

export default function NewRequestPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Request a Delivery" subtitle="Tell us what you need - we'll handle the rest." />
      <NewRequestForm />
    </div>
  );
}
