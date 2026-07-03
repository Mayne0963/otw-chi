import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

function buildCitiesPath(params: Record<string, string>) {
  const query = new URLSearchParams(params);
  return `/cities?${query.toString()}`;
}

function readQueryValue(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

export async function submitCityRequestAction(formData: FormData) {
  'use server';

  const currentUser = await getCurrentUser();
  const payload = {
    email: String(formData.get('email') ?? '').trim(),
    city: String(formData.get('city') ?? '').trim(),
    why: String(formData.get('why') ?? '').trim(),
  };

  const parsed = z
    .object({
      email: z.string().email(),
      city: z.string().min(2).max(80),
      why: z.string().max(600).optional(),
    })
    .safeParse(payload);

  if (!parsed.success) {
    redirect(
      buildCitiesPath({
        requestError: 'Please provide a valid email and city name.',
      }),
    );
  }

  const normalizedCity = parsed.data.city.replace(/\s+/g, ' ').trim();
  const messageLines = [
    'CITY_REQUEST_VOTE',
    `City: ${normalizedCity}`,
    parsed.data.why ? `Why: ${parsed.data.why}` : 'Why: No additional context provided.',
  ];

  const prisma = getPrisma();
  await prisma.contactMessage.create({
    data: {
      userId: currentUser?.id ?? undefined,
      email: parsed.data.email,
      message: messageLines.join('\n'),
    },
  });

  revalidatePath('/cities');
  redirect(
    buildCitiesPath({
      requested: '1',
      city: normalizedCity,
    }),
  );
}

export default async function CitiesPage({
  searchParams,
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const requested = readQueryValue(resolvedSearchParams?.requested);
  const requestedCity = readQueryValue(resolvedSearchParams?.city);
  const requestError = readQueryValue(resolvedSearchParams?.requestError);
  const cities = [
    {
      name: 'Fort Wayne',
      slug: 'fort-wayne',
      zones: 'North OTW • South OTW • East OTW • West OTW',
    },
  ];

  return (
    <OtwPageShell>
      <OtwSectionHeader title="OTW Cities" subtitle="Launch coverage and active zones." />

      {requested === '1' ? (
        <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          Thanks. Your vote/request for {requestedCity || 'that city'} has been submitted.
        </div>
      ) : null}
      {requestError ? (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {requestError}
        </div>
      ) : null}

      <div className="mt-3 grid sm:grid-cols-2 gap-4">
        {cities.map((c) => (
          <OtwCard key={c.slug} variant="ghost" className="p-4">
            <a className="font-semibold underline" href={`/cities/${c.slug}`}>{c.name}</a>
            <p className="text-sm opacity-75 mt-1">{c.zones}</p>
          </OtwCard>
        ))}
      </div>

      <OtwCard className="mt-4 p-5 sm:p-6">
        <h3 className="text-lg font-semibold text-white">Don&apos;t see your city?</h3>
        <p className="mt-1 text-sm text-white/70">Vote/request a new city and we&apos;ll prioritize expansion demand.</p>
        <form action={submitCityRequestAction} className="mt-4 space-y-3">
          <div>
            <label htmlFor="city-request-email" className="mb-1 block text-xs font-bold uppercase tracking-wider text-white/50">
              Email
            </label>
            <input
              id="city-request-email"
              name="email"
              type="email"
              defaultValue=""
              required
              className="w-full rounded-xl border border-white/15 bg-otwBlack/40 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="city-request-name" className="mb-1 block text-xs font-bold uppercase tracking-wider text-white/50">
              City You Want OTW In
            </label>
            <input
              id="city-request-name"
              name="city"
              type="text"
              placeholder="e.g. New Haven"
              required
              className="w-full rounded-xl border border-white/15 bg-otwBlack/40 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="city-request-why" className="mb-1 block text-xs font-bold uppercase tracking-wider text-white/50">
              Why This City? (Optional)
            </label>
            <textarea
              id="city-request-why"
              name="why"
              className="min-h-[100px] w-full rounded-xl border border-white/15 bg-otwBlack/40 px-3 py-2"
              placeholder="Tell us why this city should be next."
            />
          </div>
          <OtwButton type="submit" variant="gold" className="w-full">
            Vote / Request New City
          </OtwButton>
        </form>
      </OtwCard>
    </OtwPageShell>
  );
}
