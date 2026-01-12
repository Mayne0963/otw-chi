import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';

export default function NotFound() {
  return (
    <OtwPageShell className="flex min-h-[60vh] flex-col items-center justify-center">
      <div className="w-full max-w-md">
        <OtwEmptyState
          title="404 - Not Found"
          subtitle="Could not find requested resource"
          actionHref="/"
          actionLabel="Return Home"
        />
      </div>
    </OtwPageShell>
  );
}
