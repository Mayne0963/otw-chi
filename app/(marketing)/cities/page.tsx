import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';

export default function CitiesPage() {
  const cities = [{ name: 'Chicago', slug: 'chicago' }];
  return (
    <OtwPageShell>
      <OtwSectionHeader title="OTW Cities" subtitle="Launch coverage and active zones." />
      <div className="mt-3 grid sm:grid-cols-2 gap-4">
        {cities.map((c) => (
          <OtwCard key={c.slug} variant="ghost" className="p-4">
            <a className="font-semibold underline" href={`/cities/${c.slug}`}>{c.name}</a>
            <p className="text-sm opacity-75 mt-1">South Side • West Side • Downtown</p>
          </OtwCard>
        ))}
      </div>
    </OtwPageShell>
  );
}

