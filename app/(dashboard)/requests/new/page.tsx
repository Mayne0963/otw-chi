import { NewRequestForm } from '@/components/otw/NewRequestForm';
import { PageHeader } from '@/components/ui/page-header';

export const dynamic = 'force-dynamic';

export default function NewRequestPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="New Request" subtitle="Schedule a pickup or delivery." />
      <NewRequestForm />
    </div>
  );
}
