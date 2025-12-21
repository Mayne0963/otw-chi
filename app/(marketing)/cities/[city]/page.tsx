import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import { Metadata } from 'next';

type Props = {
  params: { city: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = params.city.charAt(0).toUpperCase() + params.city.slice(1);
  return {
    title: `Luxury Delivery & Concierge in ${city} | OTW`,
    description: `Professional food pickup, fragile item delivery, and custom concierge services in ${city}. Active coverage in Downtown, West Side, and South Side.`,
    alternates: {
      canonical: `https://ontheway.com/cities/${params.city}`,
    },
    openGraph: {
      title: `OTW ${city} - Luxury Delivery Service`,
      description: `Get what you need, when you need it. Premium delivery in ${city}.`,
    },
  };
}

export default function CityCoveragePage({ params }: Props) {
  const city = params.city.charAt(0).toUpperCase() + params.city.slice(1);
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
          <div className="h-3 w-3 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.8)]" />
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
        <section className="bg-otwBlack rounded-3xl p-8 border border-otwGold/30 text-center space-y-6">
          <h3 className="text-2xl font-bold">Get Moving in {city}</h3>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <OtwButton as="a" href="/dashboard" variant="gold">Request Delivery</OtwButton>
            <OtwButton as="a" href="/driver/apply" variant="outline">Become a Driver</OtwButton>
            <OtwButton as="a" href="/franchise/apply" variant="ghost">Franchise Inquiry</OtwButton>
          </div>
        </section>
      </div>
    </OtwPageShell>
  );
}
