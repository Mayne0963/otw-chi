import OtwButton from '@/components/ui/otw/OtwButton';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import {
  classifyErrorMessage,
  getErrorCategoryDetail,
  getErrorCategoryOrDefault,
  normalizeErrorMessage,
} from '@/lib/error-routing';

type ErrorPageSearchParams = Promise<{
  category?: string | string[];
  message?: string | string[];
  source?: string | string[];
}>;

function getSingleValue(value?: string | string[]): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function AppErrorPage({
  searchParams,
}: {
  searchParams: ErrorPageSearchParams;
}) {
  const resolved = await searchParams;
  const rawMessage = getSingleValue(resolved.message);
  const message = normalizeErrorMessage(rawMessage, 'Unexpected error');

  const rawCategory = getSingleValue(resolved.category);
  const inferredCategory = classifyErrorMessage(message);
  const category = rawCategory ? getErrorCategoryOrDefault(rawCategory) : inferredCategory;
  const categoryDetail = getErrorCategoryDetail(category);

  return (
    <OtwPageShell className="flex min-h-[70vh] items-center justify-center">
      <OtwCard className="w-full max-w-xl border-red-500/20 bg-red-950/10">
        <div className="space-y-4 text-center">
          <h1 className="text-2xl font-bold text-red-400">{categoryDetail.title}</h1>
          <p className="text-sm text-white/80">{categoryDetail.description}</p>
          <div className="rounded-lg border border-red-500/20 bg-black/30 p-3 text-left">
            <div className="text-xs uppercase tracking-wide text-white/50">Error Message</div>
            <div className="mt-1 text-sm text-white/90">{message}</div>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <OtwButton as="a" href="/" variant="gold">
              Return Home
            </OtwButton>
            <OtwButton as="a" href="/contact" variant="outline">
              Contact Support
            </OtwButton>
          </div>
        </div>
      </OtwCard>
    </OtwPageShell>
  );
}
