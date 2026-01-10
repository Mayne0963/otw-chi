import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Metadata } from 'next';

type Props = {
  params: Promise<{ city: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: rawCity } = await params;
  const city = rawCity.charAt(0).toUpperCase() + rawCity.slice(1);
  return {
    title: `Luxury Delivery & Concierge in ${city} | OTW`,
    description: `Professional food pickup, fragile item delivery, and custom concierge services in ${city}. Active coverage in Downtown, West Side, and South Side.`,
    alternates: {
      canonical: `https://otw-chi-two.vercel.app/cities/${rawCity}`,
    },
    openGraph: {
      title: `OTW ${city} - Luxury Delivery Service`,
      description: `Get what you need, when you need it. Premium delivery in ${city}.`,
    },
  };
}

export default async function CityCoveragePage({ params }: Props) {
  const { city: rawCity } = await params;
  const city = rawCity.charAt(0).toUpperCase() + rawCity.slice(1);
  const zones = ['South Side', 'West Side', 'Downtown', 'North End (Coming Soon)'];
  
  const serviceTypes = [
    { title: 'Food Pickup', desc: 'Hot meals from top restaurants, delivered with care.' },
    { title: 'Store Runs', desc: 'Groceries, retail, and essentials without the hassle.' },
    { title: 'Fragile / White Glove', desc: 'Secure transport for delicate or high-value items.' },
    { title: 'Custom Concierge', desc: 'If it fits in a car, we can move it. Just ask.' },
  ];

  return (
    <OtwPageShell>
      <div className="space-y-8">
        <OtwSectionHeader 
          title={`OTW ${city}`} 
          subtitle="Active service zones and local coverage." 
        />

        {/* Status Banner */}
        <OtwCard variant="red" className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">Service Status: ACTIVE</h3>
            <p className="text-sm opacity-90">Drivers are online in {city}.</p>
          </div>
          <div className="h-3 w-3 rounded-full bg-otwGold shadow-[0_0_10px_rgba(230,195,106,0.8)]" />
        </OtwCard>

        {/* Zones */}
        <section>
          <h3 className="text-xl font-bold mb-4">Coverage Zones</h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {zones.map((z) => (
              <OtwCard key={z} variant="ghost" className="text-center py-6 border-otwGold/20">
                <div className="font-semibold">{z}</div>
                <p className="text-xs opacity-60 mt-1">
                  {z.includes('Coming Soon') ? 'Waitlist Open' : 'Available Now'}
                </p>
              </OtwCard>
            ))}
          </div>
        </section>

        {/* Services */}
        <section>
          <h3 className="text-xl font-bold mb-4">Available Services</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {serviceTypes.map((s) => (
              <OtwCard key={s.title} variant="default" className="p-4">
                <div className="font-bold text-otwGold">{s.title}</div>
                <p className="text-sm opacity-80 mt-1">{s.desc}</p>
              </OtwCard>
            ))}
          </div>
        </section>

        {/* CTAs */}
        <section className="rounded-3xl p-8 border border-border/70 bg-card/90 text-center space-y-6 shadow-otwSoft">
          <h3 className="text-2xl font-semibold">Get Moving in {city}</h3>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button asChild variant="default">
              <Link href="/request">Request Delivery</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/driver/apply">Become a Driver</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/franchise/apply">Franchise Inquiry</Link>
            </Button>
          </div>
        </section>
      </div>
    </OtwPageShell>
  );
}
